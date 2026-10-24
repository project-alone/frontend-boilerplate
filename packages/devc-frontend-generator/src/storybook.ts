import { existsSync, readdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Node, Project, QuoteKind, SyntaxKind, ts } from 'ts-morph'
import { isMap, isScalar, parseDocument, type Scalar } from 'yaml'
import { archetypeOverlay, loadArchetypes } from './archetypes.js'
import { formatForStarter } from './format.js'
import { DefinitionError } from './manifest.js'
import {
  applyOverlay,
  type Overlay,
  overlayFiles,
  overlayTarget,
  readOptionalFile,
  STORYBOOK_OVERLAY_DIR,
} from './overlay.js'
import { loadRecipes, recipeOverlay } from './recipes.js'
import { type RenderingMode, renderingModeOverlay } from './rendering-mode.js'
import { type ChangedFile, SchematicError } from './schematics/starter-project.js'
import { withRequired } from './selection.js'

// Storybook을 더할 때 Base에서 덧입히는 overlay(ADR-0014). Starter를 만들 때는 복사하지 않는다(create-starter.ts).
const BASE_STORYBOOK: Overlay = {
  label: 'Base',
  dir: fileURLToPath(new URL(`../base/${STORYBOOK_OVERLAY_DIR}`, import.meta.url)),
}

// Storybook 설정을 두는 디렉터리. TypeScript는 점으로 시작하는 디렉터리를 `**/*.ts`로 찾지 않으므로 tsconfig.json에 따로 적는다.
const CONFIG_DIR = '.storybook'
const TSCONFIG_INCLUDE = [`${CONFIG_DIR}/**/*.ts`, `${CONFIG_DIR}/**/*.tsx`]
// `storybook build`의 결과와 Storybook이 오류를 남기는 로그. git, Docker 이미지, 린트에서 뺀다.
const STORYBOOK_OUTPUT = ['storybook-static/', '*storybook.log']
const VITEST_CONFIG = 'config/vitest.config.ts'
const GITLAB_CI = '.gitlab-ci.yml'
// GitLab CI에서 Chromium을 설치하는 잡의 틀(Base의 .gitlab-ci.yml). E2E 잡과 같은 브라우저 캐시를 쓴다.
const CHROMIUM_JOB_TEMPLATE = '.chromium'

/** Starter에 Storybook이 있는지. Storybook 설정(`.storybook/main.*`)이 있으면 있다. */
export function hasStorybook(root: string): boolean {
  const directory = join(root, CONFIG_DIR)
  return existsSync(directory) && readdirSync(directory).some((name) => name.startsWith('main.'))
}

/**
 * Starter에 Storybook을 더한다(ADR-0014). 의존성은 설치하지 않는다.
 *
 * 1. Base의 Storybook overlay(`base/storybook/`)와, Starter에 들어 있는 Rendering Mode·Recipe·Archetype의 Storybook overlay를
 *    `dcgen new`와 같은 순서와 형식으로 덧입힌다(.storybook/의 설정, package.json의 의존성과 스크립트, README의 절).
 * 2. 프로젝트가 고쳤을 수 있는 설정 파일은 패치하지 않고, 구조를 읽어 Storybook에 필요한 항목만 더한다.
 *    vitest.config.ts의 projects와 tsconfig.json의 include는 꼭 필요하므로, 찾지 못하면 아무 파일도 쓰기 전에
 *    SchematicError를 던진다. 나머지(eslint.config.ts의 globalIgnores, GitLab CI의 Chromium 잡 틀)는 찾지 못하면 건너뛰고
 *    skipped로 알린다.
 */
export async function addStorybook(
  root: string,
  renderingMode: RenderingMode,
): Promise<{ changed: ChangedFile[]; skipped: string[] }> {
  const overlays = await storybookOverlays(root, renderingMode)
  const edits: { path: string; text: string }[] = []
  const skipped: string[] = []
  const project = new Project({ useInMemoryFileSystem: true, manipulationSettings: { quoteKind: QuoteKind.Single } })

  // Vitest: .storybook/vitest-project.ts의 storybook 프로젝트를 projects에 더한다.
  const vitestText = await readOptionalFile(join(root, VITEST_CONFIG))
  const vitest = project.createSourceFile(VITEST_CONFIG, vitestText ?? '')
  const projects = vitest
    .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .find((property) => property.getName() === 'projects')
    ?.getInitializer()
  if (!Node.isArrayLiteralExpression(projects)) {
    throw new SchematicError(
      `${VITEST_CONFIG}에서 test.projects 배열을 찾지 못해 Storybook을 더하지 않았습니다. 파일은 바꾸지 않았습니다. ` +
        `Vitest 설정에 projects를 두고 다시 실행하세요(스토리를 실행하는 storybook 프로젝트를 그 배열에 더합니다).`,
    )
  }
  if (!projects.getElements().some((element) => element.getText() === 'storybookProject')) {
    projects.addElement('storybookProject')
    // Vite는 설정 파일이 불러오는 모듈에 확장자가 없으면 경고한다. TypeScript는 .js로 적어도 .ts 파일을 찾는다.
    vitest.addImportDeclaration({ moduleSpecifier: `../${CONFIG_DIR}/vitest-project.js`, namedImports: ['storybookProject'] })
    edits.push({ path: VITEST_CONFIG, text: await formatForStarter(join(root, VITEST_CONFIG), vitest.getFullText()) })
  }

  // TypeScript: .storybook/의 파일을 타입 검사(와 그 타입 정보를 쓰는 ESLint)에 넣는다. 주석은 그대로 둔다.
  const tsconfigText = (await readOptionalFile(join(root, 'tsconfig.json'))) ?? ''
  const tsconfig = ts.parseJsonText('tsconfig.json', tsconfigText).statements[0]?.expression
  const includeArray =
    tsconfig !== undefined && ts.isObjectLiteralExpression(tsconfig)
      ? tsconfig.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            ts.isStringLiteral(property.name) &&
            property.name.text === 'include' &&
            ts.isArrayLiteralExpression(property.initializer),
        )?.initializer
      : undefined
  if (includeArray === undefined || !ts.isArrayLiteralExpression(includeArray)) {
    throw new SchematicError(
      'tsconfig.json에서 include 배열을 찾지 못해 Storybook을 더하지 않았습니다. 파일은 바꾸지 않았습니다. ' +
        `include에 Starter의 파일(**/*.ts, **/*.tsx 등)을 적은 뒤 다시 실행하세요(${CONFIG_DIR}/의 파일을 그 배열에 더합니다).`,
    )
  }
  const included = includeArray.elements.flatMap((element) => (ts.isStringLiteral(element) ? [element.text] : []))
  const missingIncludes = TSCONFIG_INCLUDE.filter((pattern) => !included.includes(pattern))
  if (missingIncludes.length > 0) {
    const insertAt = includeArray.elements.end
    const separator = includeArray.elements.length > 0 ? ', ' : ''
    const added = `${separator}${missingIncludes.map((pattern) => JSON.stringify(pattern)).join(', ')}`
    edits.push({
      path: 'tsconfig.json',
      text: await formatForStarter(
        join(root, 'tsconfig.json'),
        `${tsconfigText.slice(0, insertAt)}${added}${tsconfigText.slice(insertAt)}`,
      ),
    })
  }

  // ESLint: storybook build의 결과는 린트하지 않는다. ESLint는 .gitignore를 읽지 않는다.
  const eslintText = await readOptionalFile(join(root, 'eslint.config.ts'))
  const eslint = project.createSourceFile('eslint.config.ts', eslintText ?? '')
  const ignores = eslint
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText() === 'globalIgnores')
    ?.getArguments()[0]
  if (!Node.isArrayLiteralExpression(ignores)) {
    if (eslintText !== undefined) skipped.push(`eslint.config.ts의 globalIgnores를 찾지 못해 ${STORYBOOK_OUTPUT[0]}을(를) 린트에서 빼지 않았습니다.`)
  } else if (!ignores.getElements().some((element) => element.getText() === `'${STORYBOOK_OUTPUT[0]}'`)) {
    ignores.addElement(`'${STORYBOOK_OUTPUT[0]}'`)
    edits.push({ path: 'eslint.config.ts', text: await formatForStarter(join(root, 'eslint.config.ts'), eslint.getFullText()) })
  }

  // git과 Docker 이미지(docker Recipe의 .dockerignore)에서 Storybook의 결과물을 뺀다.
  for (const path of ['.gitignore', '.dockerignore']) {
    const text = await readOptionalFile(join(root, path))
    if (text === undefined && path === '.dockerignore') continue
    const lines = (text ?? '').split('\n')
    const missing = STORYBOOK_OUTPUT.filter((line) => !lines.includes(line))
    if (missing.length === 0) continue
    const body = text === undefined || text === '' ? '' : `${text.replace(/\n*$/, '\n')}\n`
    edits.push({ path, text: `${body}# Storybook\n${missing.join('\n')}\n` })
  }

  // GitLab CI: E2E처럼 Chromium을 설치하는 잡의 틀로 test:storybook 잡을 test 잡 뒤에 더한다.
  const ciText = await readOptionalFile(join(root, GITLAB_CI))
  if (ciText !== undefined) {
    const ci = parseDocument(ciText)
    if (!isMap(ci.contents) || !ci.has(CHROMIUM_JOB_TEMPLATE)) {
      skipped.push(
        `${GITLAB_CI}에서 Chromium을 설치하는 잡의 틀(${CHROMIUM_JOB_TEMPLATE})을 찾지 못해 test:storybook 잡을 더하지 않았습니다.`,
      )
    } else if (!ci.has('test:storybook')) {
      const job = ci.createPair('test:storybook', {
        extends: CHROMIUM_JOB_TEMPLATE,
        stage: 'check',
        script: ['npm run test:storybook'],
      })
      const key = job.key as Scalar
      key.spaceBefore = true
      key.commentBefore = ' 스토리마다 브라우저(Chromium)에서 접근성(axe)과 play 함수를 검사한다(README의 "Storybook").'
      const jobs = ci.contents.items
      const test = jobs.findIndex((pair) => isScalar(pair.key) && pair.key.value === 'test')
      jobs.splice(test === -1 ? jobs.length : test + 1, 0, job as (typeof jobs)[number])
      edits.push({ path: GITLAB_CI, text: await formatForStarter(join(root, GITLAB_CI), ci.toString({ lineWidth: 0 })) })
    }
  }

  // 무엇을 바꾸는지는 쓰기 전에 정한다. 이미 있던 파일은 고친 것이다.
  const paths = [
    ...new Set([
      ...(await Promise.all(overlays.map(async ({ dir }) => (await overlayFiles(dir)).map(overlayTarget)))).flat(),
      ...edits.map(({ path }) => path),
    ]),
  ]
  const changed = paths.map((path) => ({ path, created: !existsSync(join(root, path)) }))
  for (const overlay of overlays) await applyOverlay(root, overlay, [])
  for (const { path, text } of edits) await writeFile(join(root, path), text)
  return { changed, skipped }
}

/**
 * Storybook을 더할 때 덧입힐 overlay를 덧입힐 순서대로 돌려준다. Base의 것은 늘 넣는다. Rendering Mode의 것은 Starter의
 * Rendering Mode일 때 넣는다. Starter는 고른 Recipe·Archetype을 기록하지 않으므로, Recipe·Archetype의 것은 그 overlay가
 * 가져다 쓰는 Starter 모듈(`@/...`)이 Starter에 모두 있을 때 넣는다. Starter 모듈을 하나도 쓰지 않는 overlay는 넣을지 정할 수
 * 없으므로 DefinitionError를 던진다.
 */
async function storybookOverlays(root: string, renderingMode: RenderingMode): Promise<Overlay[]> {
  const recipes = await loadRecipes()
  const byName = new Map(recipes.map((recipe) => [recipe.name, recipe]))
  const ordered = [
    ...withRequired(
      recipes.map(({ name }) => name),
      byName,
    ).map(({ recipe }) => recipeOverlay(recipe)),
    ...(await loadArchetypes(recipes)).map(archetypeOverlay),
  ]
  const storybookOf = ({ label, dir }: Overlay): Overlay | undefined => {
    const storybookDir = join(dir, STORYBOOK_OVERLAY_DIR)
    return existsSync(storybookDir) ? { label, dir: storybookDir } : undefined
  }

  const mode = renderingModeOverlay(renderingMode)
  const modeStorybook = mode === undefined ? undefined : storybookOf(mode)
  const overlays = modeStorybook === undefined ? [BASE_STORYBOOK] : [BASE_STORYBOOK, modeStorybook]
  for (const candidate of ordered) {
    const overlay = storybookOf(candidate)
    if (overlay === undefined) continue
    // 패치는 더하는 줄만 본다. 맥락 줄과 지우는 줄은 Base의 Storybook 설정에 있던 것이다.
    const sources = await Promise.all(
      (await overlayFiles(overlay.dir)).map(async (path) => {
        const text = await readFile(join(overlay.dir, path), 'utf8')
        if (overlayTarget(path) === path) return text
        return text
          .split('\n')
          .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
          .join('\n')
      }),
    )
    const modules = [...sources.join('\n').matchAll(/(?:from|import)\s+'@\/([^']+)'/g)].map(([, module = '']) => module)
    if (modules.length === 0) {
      throw new DefinitionError(
        `${overlay.label}의 ${STORYBOOK_OVERLAY_DIR}/가 Starter 모듈(@/...)을 하나도 가져오지 않아, Starter에 ${overlay.label}이(가) 들어 있는지 알 수 없습니다(ADR-0014).`,
      )
    }
    const present = (module: string) =>
      ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].some((suffix) => existsSync(join(root, 'src', `${module}${suffix}`)))
    if (modules.every(present)) overlays.push(overlay)
  }
  return overlays
}
