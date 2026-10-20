import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Ajv } from 'ajv'
import addFormats from 'ajv-formats'
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest'
import { parse } from 'yaml'
import { run } from './run.ts'

// GitLab이 파이프라인 편집기에서 쓰는 공식 CI 설정 스키마를 레포에 담아 두고 쓴다(오프라인에서도 같은 결과).
// 출처: https://gitlab.com/gitlab-org/gitlab/-/raw/28aa2bf90771a11ecc2f86525bc8a70a49c4d810/app/assets/javascripts/editor/schema/ci.json
// 2026-10-20에 받았다. 갱신할 때는 같은 경로의 최신 커밋에서 받아 이 주석의 커밋과 날짜를 바꾼다.
const GITLAB_CI_SCHEMA = join(import.meta.dirname, 'schemas', 'gitlab-ci.json')

// 설정 파일만 읽으므로 Starter를 설치하지 않는다.
let workdir: string

beforeAll(() => {
  workdir = mkdtempSync(join(tmpdir(), 'dcgen-gitlab-ci-'))
})

afterAll(() => {
  rmSync(workdir, { recursive: true, force: true })
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** GitLab이 읽는 것처럼 앵커와 병합 키(`<<`)를 풀어서 읽는다. */
function readGitlabCi(starter: string): Record<string, unknown> {
  const config: unknown = parse(readFileSync(join(starter, '.gitlab-ci.yml'), 'utf8'), { merge: true })
  if (!isRecord(config)) throw new Error('.gitlab-ci.yml의 최상위가 객체가 아닙니다.')
  return config
}

/** 값이 객체인 최상위 항목. 잡, 숨긴 잡(.으로 시작), default, variables가 여기에 든다. */
function ciSections(starter: string): Record<string, unknown>[] {
  return Object.values(readGitlabCi(starter)).filter(isRecord)
}

/** 명령 줄에서 실행하는 npm 스크립트 이름. `npm run <이름>`, `npm test`, `npm start` 형태를 읽는다. */
function npmScriptsIn(lines: unknown): string[] {
  return [lines]
    .flat(Infinity)
    .filter((line): line is string => typeof line === 'string')
    .flatMap((command) =>
      [...command.matchAll(/\bnpm (?:run ([^\s;&|]+)|(test|start)\b)/g)].flatMap(
        ([, script, lifecycle]) => script ?? lifecycle ?? [],
      ),
    )
}

/** CI가 실행하는 npm 스크립트 이름 */
function ciNpmScripts(starter: string): string[] {
  return ciSections(starter).flatMap((section) =>
    npmScriptsIn([section['before_script'], section['script'], section['after_script']]),
  )
}

// Starter 단위 Rendering Mode마다 CI 설정을 검사한다. e2eArtifacts는 E2E 잡이 build 잡에서 받아야 하는 빌드 결과다.
// server는 `next start`로 띄울 .next/를 받고, static-export는 MSW를 켜고 직접 다시 빌드하므로 받지 않는다.
describe.each([
  { renderingMode: 'server', e2eArtifacts: ['.next/'] },
  { renderingMode: 'static-export', e2eArtifacts: [] },
])('Rendering Mode $renderingMode', ({ renderingMode, e2eArtifacts }) => {
  let starter: string

  beforeAll(() => {
    const cwd = join(workdir, renderingMode)
    mkdirSync(cwd)
    const created = run(inject('dcgenBin'), ['new', 'my-app', '--rendering-mode', renderingMode], cwd)
    expect(created.status, created.output).toBe(0)
    starter = join(cwd, 'my-app')
  })

  test('Starter의 GitLab CI 설정은 GitLab 공식 스키마를 통과한다', () => {
    const schema = JSON.parse(readFileSync(GITLAB_CI_SCHEMA, 'utf8')) as object
    // 스키마에 편집기용 키워드(markdownDescription 등)가 있어 strict 모드는 끈다.
    const ajv = new Ajv({ strict: false, allErrors: true })
    addFormats.default(ajv)
    const validate = ajv.compile(schema)

    const valid = validate(readGitlabCi(starter))

    expect(valid, ajv.errorsText(validate.errors, { separator: '\n' })).toBe(true)
  })

  test('GitLab CI는 lint, format:check, 타입 검사, 단위 테스트, 빌드, E2E를 실행한다', () => {
    expect(ciNpmScripts(starter)).toEqual(
      expect.arrayContaining(['lint', 'format:check', 'typecheck', 'test', 'build', 'test:e2e']),
    )
  })

  test('GitLab CI가 실행하는 npm 스크립트는 모두 Starter의 package.json에 있다', () => {
    const { scripts } = JSON.parse(readFileSync(join(starter, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }

    const missing = ciNpmScripts(starter).filter((script) => !Object.hasOwn(scripts, script))

    expect(missing).toEqual([])
  })

  test('GitLab CI는 .nvmrc와 같은 메이저 버전의 Node 이미지를 쓴다', () => {
    const images = ciSections(starter)
      .map((section) => section['image'])
      .filter((image) => image !== undefined)
      .map((image) => (isRecord(image) ? image['name'] : image))

    expect(images.length).toBeGreaterThan(0)
    const nvmrc = readFileSync(join(starter, '.nvmrc'), 'utf8').trim()
    for (const image of images) expect(image).toMatch(new RegExp(`^node:${nvmrc}(?:-|$)`))
  })

  test(`E2E 잡은 build 잡에서 필요한 빌드 결과(${e2eArtifacts.join(', ') || '없음'})만 받는다`, () => {
    const config = readGitlabCi(starter)
    const e2eJob = Object.values(config)
      .filter(isRecord)
      .find((section) => npmScriptsIn(section['script']).includes('test:e2e'))
    if (e2eJob === undefined) throw new Error('test:e2e를 실행하는 잡이 없습니다.')

    // 아티팩트를 받을 잡은 needs나 dependencies로 적는다. 둘 다 없으면 GitLab이 앞 단계의 아티팩트를 모두 받으므로 허용하지 않는다.
    const sources = e2eJob['needs'] ?? e2eJob['dependencies']
    expect(sources, 'E2E 잡의 needs 또는 dependencies').toBeDefined()
    const artifactPaths = [sources]
      .flat()
      .map((source) => (isRecord(source) ? source['job'] : source))
      .map((name) => (typeof name === 'string' ? config[name] : undefined))
      .filter(isRecord)
      .flatMap((job) => (isRecord(job['artifacts']) ? [job['artifacts']['paths']].flat() : []))

    expect(artifactPaths).toEqual(e2eArtifacts)
  })
})
