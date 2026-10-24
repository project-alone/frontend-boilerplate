import { existsSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { Node, Project, ts, type Type } from 'ts-morph'
import { installDependencies } from '../new-command.js'
import { addStorybook, hasStorybook } from '../storybook.js'
import { isIdentifier, kebabCase, pascalCase, splitWords } from './names.js'
import { type ChangedFile, PROP_SAMPLES, SchematicError, StarterProject } from './starter-project.js'

// 컴포넌트 이름(PascalCase). 소문자가 하나는 있어야 상수(THEME_LABELS 등)와 나뉜다.
const COMPONENT_NAME = /^[A-Z][A-Za-z\d]*[a-z][A-Za-z\d]*$/

// 생성하는 스토리가 가져오거나 선언하는 이름. 컴포넌트 이름이 이와 같으면 생성한 코드가 컴파일되지 않는다.
const STORY_NAMES = ['Meta', 'StoryObj', 'Story', 'Default']

// 값을 정할 때 따라 들어가는 객체의 깊이. 더 깊으면 값을 정하지 않는다(자기 자신을 가리키는 타입 등).
const MAX_SAMPLE_DEPTH = 4

export interface StorySchematicOptions {
  /** 파일이 내보내는 컴포넌트 가운데 스토리를 만들 컴포넌트. 없으면 파일에서 고른다. */
  component: string | undefined
  /** Storybook을 더할 때 의존성을 설치하지 않는다. */
  skipInstall: boolean
}

export interface StoryResult {
  changed: ChangedFile[]
  /** 스토리를 만든 컴포넌트 */
  componentName: string
  /** 이번에 Starter에 Storybook을 더했는지 */
  storybookAdded: boolean
  /** Storybook을 더하며 의존성을 설치했는지. Storybook을 더하지 않았으면 false다. */
  installed: boolean
  /** Storybook을 더하며 찾지 못해 건너뛴 설정 */
  skipped: string[]
  /** 컴포넌트 파일이 TanStack Query나 Query Domain을 가져다 쓰는지. 그러면 스토리에서 데이터를 정해야 한다. */
  fetchesData: boolean
}

/**
 * `story` Schematic. file(cwd 기준)이 내보내는 컴포넌트의 Storybook 스토리를 컴포넌트 옆에 만든다(ADR-0014). Starter에 Storybook이
 * 없으면 먼저 Storybook을 더하고(storybook.ts), skipInstall이 아니면 의존성을 설치한다.
 *
 * - 컴포넌트는 --component로 고르거나, 없으면 default로 내보낸 컴포넌트, 하나뿐인 컴포넌트, 파일과 이름이 같은 컴포넌트 순으로 고른다.
 * - 스토리 파일은 컴포넌트를 default로 내보내면 컴포넌트 파일과 같은 이름(`not-found.stories.tsx`), 이름으로 내보내면 컴포넌트
 *   이름의 kebab-case(`field-label.stories.tsx`)다.
 * - 필수 props와 children에는 타입에 맞는 값을 넘긴다. 값을 정할 수 없는 필수 props가 있으면 SchematicError를 던진다.
 * - 파일이나 컴포넌트가 맞지 않거나 스토리 파일이 이미 있으면 SchematicError를 던지고 아무 파일도 바꾸지 않는다.
 */
export async function generateStory(cwd: string, file: string, options: StorySchematicOptions): Promise<StoryResult> {
  const starter = StarterProject.open(cwd)
  const absolute = resolve(cwd, file)
  const path = relative(starter.root, absolute).split(sep).join('/')
  if (!path.startsWith('src/') || !path.endsWith('.tsx') || /\.(stories|test)\.tsx$/.test(path)) {
    throw new SchematicError(`스토리는 src 아래의 컴포넌트 파일(.tsx)에 만듭니다: ${path}`)
  }
  if (!existsSync(absolute)) throw new SchematicError(`파일이 없습니다: ${path}`)

  // props 타입을 읽으려고 Starter의 tsconfig(경로 별칭 @/, 설치한 패키지의 타입)로 컴포넌트 파일을 연다.
  const project = new Project({ tsConfigFilePath: join(starter.root, 'tsconfig.json'), skipAddingFilesFromTsConfig: true })
  const module = project.addSourceFileAtPath(absolute)
  const stem = basename(path, '.tsx')
  const fileName = basename(path)
  const components = [...module.getExportedDeclarations()].flatMap(([exportName, declarations]) => {
    const isDefault = exportName === 'default'
    return declarations.flatMap((declaration) => {
      // default로 내보낸 이름 없는 함수는 파일 이름을 PascalCase로 바꿔 부른다.
      const declaredName = Node.hasName(declaration) ? declaration.getName() : undefined
      const name = isDefault ? (declaredName ?? pascalCase(splitWords(stem))) : exportName
      const callable = declaration.getType().getCallSignatures().length > 0
      return COMPONENT_NAME.test(name) && callable ? [{ name, isDefault, declaration }] : []
    })
  })
  if (components.length === 0) throw new SchematicError(`${fileName}는 컴포넌트를 내보내지 않습니다: ${path}`)
  const listed = components.map(({ name }) => name).join(', ')
  const component =
    options.component === undefined
      ? (components.find(({ isDefault }) => isDefault) ??
        (components.length === 1 ? components[0] : components.find(({ name }) => kebabCase(splitWords(name)) === stem)))
      : components.find(({ name }) => name === options.component)
  if (component === undefined) {
    throw new SchematicError(
      options.component === undefined
        ? `${fileName}는 컴포넌트를 여럿 내보냅니다(${listed}). 스토리를 만들 컴포넌트를 --component로 고르세요.`
        : `${fileName}는 '${options.component}' 컴포넌트를 내보내지 않습니다. 내보내는 컴포넌트: ${listed}`,
    )
  }
  if (STORY_NAMES.includes(component.name)) {
    throw new SchematicError(
      `스토리를 만들 수 없는 컴포넌트 이름입니다: '${component.name}'. 생성하는 스토리가 쓰는 이름과 겹칩니다. 컴포넌트 이름을 바꾸세요.`,
    )
  }

  const { declaration } = component
  const implementation = Node.isVariableDeclaration(declaration) ? declaration.getInitializer() : declaration
  const [signature] = declaration.getType().getCallSignatures()
  const returnsPromise = signature?.getReturnType().getSymbol()?.getName() === 'Promise'
  if ((Node.isAsyncable(implementation) && implementation.isAsync()) || returnsPromise) {
    throw new SchematicError(
      `서버 컴포넌트(async 함수)는 Storybook이 그리지 못합니다: ${component.name}. 데이터를 가져오는 부분과 화면을 나눠, 화면을 그리는 컴포넌트의 스토리를 만드세요.`,
    )
  }

  // props에 넘길 값. 필수 props에는 타입에 맞는 값을 넘기고, 선택 props는 children(글자)만 넘긴다. 값을 정하지 못하면 undefined다.
  let usesFn = false
  const sample = (type: Type, name: string, depth: number): string | undefined => {
    if (type.isString() || type.isTemplateLiteral() || type.isUnknown() || type.isAny()) return `'${name}'`
    if (type.isStringLiteral() || type.isNumberLiteral() || type.isBooleanLiteral()) return type.getText()
    if (type.isNumber()) return PROP_SAMPLES.get('number')
    if (type.isBoolean()) return PROP_SAMPLES.get('boolean')
    if (type.isNull()) return 'null'
    if (type.isUndefined()) return 'undefined'
    if (type.isUnion()) {
      // ReactNode처럼 글자를 받는 타입은 글자를, null을 받는 타입은 null을 넘긴다. 아니면 값을 정할 수 있는 첫 타입이고,
      // undefined는 마지막에 고른다.
      const members = type.getUnionTypes()
      const candidates = [
        ...members.filter((member) => member.isString()),
        ...members.filter((member) => member.isNull()),
        ...members.filter((member) => !member.isUndefined()),
        ...members.filter((member) => member.isUndefined()),
      ]
      for (const member of candidates) {
        const value = sample(member, name, depth)
        if (value !== undefined) return value
      }
      return undefined
    }
    if (type.isArray() || type.isReadonlyArray()) return '[]'
    if (type.getCallSignatures().length > 0) {
      usesFn = true
      return 'fn()'
    }
    const symbols = [type, ...type.getIntersectionTypes()].map((part) => part.getSymbol()?.getName())
    if (symbols.includes('Date')) return "new Date('2026-01-01T00:00:00.000Z')"
    if (symbols.includes('Error')) return `new Error('${name}')`
    if (symbols.includes('ReactElement')) return `<span>${name}</span>`
    if (!(type.isObject() || type.isIntersection()) || type.isTuple() || depth >= MAX_SAMPLE_DEPTH) return undefined
    const fields: string[] = []
    for (const property of type.getProperties()) {
      if (property.hasFlags(ts.SymbolFlags.Optional)) continue
      const value = sample(property.getTypeAtLocation(declaration), property.getName(), depth + 1)
      if (value === undefined) return undefined
      fields.push(`${isIdentifier(property.getName()) ? property.getName() : JSON.stringify(property.getName())}: ${value}`)
    }
    return `{ ${fields.join(', ')} }`
  }
  const unknown: string[] = []
  const props = signature?.getParameters()[0]?.getTypeAtLocation(declaration)
  const args = (props?.getProperties() ?? []).flatMap((property) => {
    const name = property.getName()
    const type = property.getTypeAtLocation(declaration)
    const optional = property.hasFlags(ts.SymbolFlags.Optional)
    if (optional && name !== 'children') return []
    const value = sample(type, name === 'children' ? component.name : name, 0)
    if (value === undefined) {
      if (!optional) unknown.push(`${name}(${type.getText(declaration)})`)
      return []
    }
    return [`${isIdentifier(name) ? name : JSON.stringify(name)}: ${value}`]
  })
  if (unknown.length > 0) {
    throw new SchematicError(
      `스토리가 넘길 값을 정하지 못한 필수 props가 있어 스토리를 만들지 않았습니다: ${unknown.join(', ')}. ` +
        '문자열, 숫자, 불리언, 리터럴, 함수, 배열, Date, Error와 그 값들로 이뤄진 객체만 정할 수 있습니다. 직접 스토리를 쓰거나, ' +
        'props에 기본값을 두어 선택 props로 바꾼 뒤 다시 실행하세요.',
    )
  }

  // 스토리 제목은 src 아래 폴더를 PascalCase로 이은 것이다(예: Features/Orders/OrderSummary, Shared/UI/Button, App/NotFound).
  const folders = dirname(path).split('/').slice(1)
  const title = [...folders.map((folder) => (folder === 'ui' ? 'UI' : pascalCase(splitWords(folder)))), component.name]
    .filter((part) => part !== '')
    .join('/')
  starter.newModules([
    {
      stem: `${dirname(path)}/${component.isDefault ? stem : kebabCase(splitWords(component.name))}.stories`,
      source: `import type { Meta, StoryObj } from '@storybook/nextjs-vite'
${usesFn ? "import { fn } from 'storybook/test'\n" : ''}import ${component.isDefault ? component.name : `{ ${component.name} }`} from './${stem}'

const meta = {
  title: '${title}',
  component: ${component.name},${args.length > 0 ? `\n  args: { ${args.join(', ')} },` : ''}
} satisfies Meta<typeof ${component.name}>

export default meta

type Story = StoryObj<typeof meta>

// 컴포넌트가 보일 수 있는 상태(변형, 비활성, 오류 등)마다 스토리를 더한다. npm run test:storybook이 스토리마다 접근성(axe)을
// 검사하고, play 함수에 적은 상호작용도 확인한다.
export const Default: Story = {}
`,
    },
  ])

  const storybookAdded = !hasStorybook(starter.root)
  const setup = storybookAdded ? await addStorybook(starter.root, starter.renderingMode()) : { changed: [], skipped: [] }
  const story = await starter.save()
  const installed = storybookAdded && !options.skipInstall && installDependencies(starter.root)
  const imports = module.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue())
  return {
    changed: [...setup.changed, ...story],
    componentName: component.name,
    storybookAdded,
    installed,
    skipped: setup.skipped,
    fetchesData: imports.some((specifier) => specifier === '@tanstack/react-query' || specifier.startsWith('@/queries/')),
  }
}
