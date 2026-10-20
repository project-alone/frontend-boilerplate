import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Ajv } from 'ajv'
import addFormats from 'ajv-formats'
import { afterAll, beforeAll, expect, inject, test } from 'vitest'
import { parse } from 'yaml'
import { run } from './run.ts'

// GitLab이 파이프라인 편집기에서 쓰는 공식 CI 설정 스키마를 레포에 담아 두고 쓴다(오프라인에서도 같은 결과).
// 출처: https://gitlab.com/gitlab-org/gitlab/-/raw/28aa2bf90771a11ecc2f86525bc8a70a49c4d810/app/assets/javascripts/editor/schema/ci.json
// 2026-10-20에 받았다. 갱신할 때는 같은 경로의 최신 커밋에서 받아 이 주석의 커밋과 날짜를 바꾼다.
const GITLAB_CI_SCHEMA = join(import.meta.dirname, 'schemas', 'gitlab-ci.json')

// 설정 파일만 읽으므로 Starter를 설치하지 않는다.
let workdir: string
let starter: string

beforeAll(() => {
  workdir = mkdtempSync(join(tmpdir(), 'dcgen-gitlab-ci-'))
  const created = run(inject('dcgenBin'), ['new', 'my-app'], workdir)
  expect(created.status, created.output).toBe(0)
  starter = join(workdir, 'my-app')
})

afterAll(() => {
  rmSync(workdir, { recursive: true, force: true })
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** GitLab이 읽는 것처럼 앵커와 병합 키(`<<`)를 풀어서 읽는다. */
function readGitlabCi(): Record<string, unknown> {
  const config: unknown = parse(readFileSync(join(starter, '.gitlab-ci.yml'), 'utf8'), { merge: true })
  if (!isRecord(config)) throw new Error('.gitlab-ci.yml의 최상위가 객체가 아닙니다.')
  return config
}

/** 값이 객체인 최상위 항목. 잡, 숨긴 잡(.으로 시작), default, variables가 여기에 든다. */
function ciSections(): Record<string, unknown>[] {
  return Object.values(readGitlabCi()).filter(isRecord)
}

/** CI가 실행하는 npm 스크립트 이름. `npm run <이름>`, `npm test`, `npm start` 형태를 읽는다. */
function ciNpmScripts(): string[] {
  return ciSections()
    .flatMap((section) => [section['before_script'], section['script'], section['after_script']])
    .flatMap((lines) => [lines].flat(Infinity))
    .filter((line): line is string => typeof line === 'string')
    .flatMap((command) =>
      [...command.matchAll(/\bnpm (?:run ([^\s;&|]+)|(test|start)\b)/g)].flatMap(
        ([, script, lifecycle]) => script ?? lifecycle ?? [],
      ),
    )
}

test('Starter의 GitLab CI 설정은 GitLab 공식 스키마를 통과한다', () => {
  const schema = JSON.parse(readFileSync(GITLAB_CI_SCHEMA, 'utf8')) as object
  // 스키마에 편집기용 키워드(markdownDescription 등)가 있어 strict 모드는 끈다.
  const ajv = new Ajv({ strict: false, allErrors: true })
  addFormats.default(ajv)
  const validate = ajv.compile(schema)

  const valid = validate(readGitlabCi())

  expect(valid, ajv.errorsText(validate.errors, { separator: '\n' })).toBe(true)
})

test('GitLab CI는 lint, format:check, 타입 검사, 단위 테스트, 빌드, E2E를 실행한다', () => {
  expect(ciNpmScripts()).toEqual(
    expect.arrayContaining(['lint', 'format:check', 'typecheck', 'test', 'build', 'test:e2e']),
  )
})

test('GitLab CI가 실행하는 npm 스크립트는 모두 Starter의 package.json에 있다', () => {
  const { scripts } = JSON.parse(readFileSync(join(starter, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>
  }

  const missing = ciNpmScripts().filter((script) => !Object.hasOwn(scripts, script))

  expect(missing).toEqual([])
})

test('GitLab CI는 .nvmrc와 같은 메이저 버전의 Node 이미지를 쓴다', () => {
  const images = ciSections()
    .map((section) => section['image'])
    .filter((image) => image !== undefined)
    .map((image) => (isRecord(image) ? image['name'] : image))

  expect(images.length).toBeGreaterThan(0)
  const nvmrc = readFileSync(join(starter, '.nvmrc'), 'utf8').trim()
  for (const image of images) expect(image).toMatch(new RegExp(`^node:${nvmrc}(?:-|$)`))
})
