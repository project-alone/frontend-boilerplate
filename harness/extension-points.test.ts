import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, test } from 'vitest'
import { parse } from 'yaml'
import { type BackgroundProcess, freePort, run, start, waitForServer } from './run.ts'
import { expectFileToPass, readTree, runVitestScript, useStarter } from './starter.ts'

// Recipe 조합 확장 지점(docs/recipes.md의 "확장 지점"). 같은 지점을 쓰는 시험용 Recipe 둘(extension-a-fixture,
// extension-b-fixture)을 함께 켠 Starter로, 두 Recipe의 조각이 텍스트 패치 없이 함께 조립되는지 본다.
// 앞쪽 테스트는 설치 없이 Generator가 만든 파일을 보고, 끝의 매트릭스는 Starter를 설치해 스크립트와 동작을 본다.

const FIXTURES = ['--recipe', 'extension-a-fixture', '--recipe', 'extension-b-fixture']

let workdir: string

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'dcgen-extension-points-'))
})

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true })
})

/** 시험용 Recipe를 더한 Generator로 workdir/<directory>에 my-app을 만든다. */
function dcgenNew(args: readonly string[], directory = '.') {
  const cwd = join(workdir, directory)
  mkdirSync(cwd, { recursive: true })
  const result = run(inject('dcgenWithFixturesBin'), ['new', 'my-app', ...args, '--skip-install'], cwd)
  return { ...result, starter: join(cwd, 'my-app') }
}

interface OpenApi {
  tags: { name: string }[]
  paths: Record<string, Record<string, { operationId: string }>>
  components: { schemas: Record<string, unknown> }
}

describe('OpenAPI 명세 조각', () => {
  test('Recipe의 명세 조각은 Base 명세와 구조적으로 병합되고, 병합된 명세로 재생성 계층이 다시 만들어진다', () => {
    const result = dcgenNew(FIXTURES)
    expect(result.status, result.output).toBe(0)

    const text = readFileSync(join(result.starter, 'openapi.yaml'), 'utf8')
    const spec = parse(text) as OpenApi
    expect(Object.keys(spec.paths)).toEqual(['/products', '/alphas', '/betas/{betaId}', '/products/{productId}'])
    expect(Object.keys(spec.components.schemas)).toEqual(['Product', 'NewProduct', 'Alpha', 'Beta'])
    expect(spec.tags.map(({ name }) => name)).toEqual(['products', 'alphas', 'betas'])
    // Base 명세와 조각의 주석이 남는다.
    expect(text).toContain('# API 계층의 원본이 되는 OpenAPI 명세.')
    expect(text).toContain('# extension-a-fixture가 더한 operation')

    // `npm run g`도 이 openapi.yaml을 읽는다. 재생성 계층(orval)에는 조각의 operation이 들어 있다.
    const generated = readTree(join(result.starter, 'src/shared/api/generated'))
    expect(generated['alphas/alphas.ts']).toContain('export const listAlphas')
    expect(generated['betas/betas.ts']).toContain('export const getBeta')
    expect(generated['products/products.ts']).toContain('export const getProduct')
    expect(generated['index.msw.ts']).toContain('getAlphasMock')
  })

  test('Recipe 조각이 없으면 Base 명세와 재생성 계층을 그대로 둔다', () => {
    const base = dcgenNew([], 'base')
    const darkMode = dcgenNew(['--recipe', 'dark-mode'], 'dark-mode')
    expect(base.status, base.output).toBe(0)
    expect(darkMode.status, darkMode.output).toBe(0)

    expect(readFileSync(join(darkMode.starter, 'openapi.yaml'), 'utf8')).toBe(
      readFileSync(join(base.starter, 'openapi.yaml'), 'utf8'),
    )
    expect(readTree(join(darkMode.starter, 'src/shared/api/generated'))).toEqual(
      readTree(join(base.starter, 'src/shared/api/generated')),
    )
  })

  test('경로, 스키마 이름, tag, operationId가 Base나 다른 Recipe와 겹치면 무엇이 겹치는지 모두 알리고 아무것도 만들지 않는다', () => {
    const result = dcgenNew([...FIXTURES, '--recipe', 'spec-collision-fixture'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Recipe spec-collision-fixture')
    for (const collision of [
      'paths./products(Base)',
      'paths./alphas(Recipe extension-a-fixture)',
      'components.schemas.Product(Base)',
      'components.schemas.Alpha(Recipe extension-a-fixture)',
      'tags.products(Base)',
      'operationId listProducts(Base)',
    ]) {
      expect(result.output).toContain(collision)
    }
    expect(readdirSync(workdir)).toEqual([])
    expect(existsSync(result.starter)).toBe(false)
  })
})

/** dotenv 파일의 변수 이름을 적힌 순서대로 */
function variables(text: string): string[] {
  return [...text.matchAll(/^([A-Z_]+)=/gm)].map(([, name]) => name ?? '')
}

describe('환경 변수', () => {
  test.each([
    ['server', []],
    ['static-export', ['NEXT_PUBLIC_API_MOCKING']],
  ])(
    'Rendering Mode %s: Recipe가 더한 변수는 예시 파일(.env.example)과 개발용 값(.env.development)에 변수 단위로 병합된다',
    (renderingMode, modeVariables) => {
      const result = dcgenNew(['--rendering-mode', renderingMode, ...FIXTURES])
      expect(result.status, result.output).toBe(0)

      const development = readFileSync(join(result.starter, '.env.development'), 'utf8')
      // Base의 변수(API_MOCKING)를 같은 값으로 다시 적은 Recipe는 그 항목(주석 포함)을 그 자리에서 바꾸고, 새 변수는 덧입힌
      // 순서대로 끝에 덧붙인다.
      expect(variables(development)).toEqual(['API_MOCKING', ...modeVariables, 'FIXTURE_A_DEV', 'FIXTURE_B_DEV'])
      expect(development).toContain('# extension-b-fixture: Base의 변수를 같은 값으로 다시 적는다.')
      expect(development).toContain('# extension-b-fixture가 더하는 값(변수에 붙지 않은 주석)\n\n# FIXTURE_B_DEV의 설명\n')
      expect(development.startsWith('# `npm run dev`에서만 읽는다.'), development).toBe(true)

      const example = readFileSync(join(result.starter, '.env.example'), 'utf8')
      expect(variables(example)).toEqual(['API_BASE_URL', 'NEXT_PUBLIC_API_BASE_URL', 'FIXTURE_A_SECRET', 'FIXTURE_B_SECRET'])
      expect(example).toContain('# extension-a-fixture의 배포 환경 값\nFIXTURE_A_SECRET=\n')
    },
  )

  test('같은 dotenv 파일의 같은 변수에 Base나 다른 Recipe와 다른 값을 적으면 변수와 두 곳을 모두 알리고 아무것도 만들지 않는다', () => {
    // dotenv-conflict-fixture는 extension-a-fixture보다 먼저 덧입혀진다(이름순).
    const result = dcgenNew(['--recipe', 'extension-a-fixture', '--recipe', 'dotenv-conflict-fixture'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('환경 변수 파일의 같은 변수에 서로 다른 값을 적은 곳이 있어 병합할 수 없습니다.')
    expect(result.output).toContain(
      "- .env.development의 API_MOCKING: Base에서 'enabled', Recipe dotenv-conflict-fixture에서 'disabled'",
    )
    expect(result.output).toContain(
      "- .env.development의 FIXTURE_A_DEV: Recipe dotenv-conflict-fixture에서 'conflict', Recipe extension-a-fixture에서 'a'",
    )
    // 따옴표나 값 뒤의 주석만 다른 같은 값(.env.example의 API_BASE_URL="", FIXTURE_A_SECRET= # ...)은 겹친 것이 아니다.
    expect(result.output).not.toContain('API_BASE_URL')
    expect(result.output).not.toContain('FIXTURE_A_SECRET')
    expect(readdirSync(workdir)).toEqual([])
    expect(existsSync(result.starter)).toBe(false)
  })
})

describe('Provider, 머리글, proxy, next.config, instrumentation의 선언(extensions.json)', () => {
  test('proxy는 요청을 받는 서버가 있는 server Starter에만 만들고, static-export Starter에는 만들지 않는다', () => {
    const server = dcgenNew(['--rendering-mode', 'server', ...FIXTURES], 'server')
    const staticExport = dcgenNew(['--rendering-mode', 'static-export', ...FIXTURES], 'static-export')
    expect(server.status, server.output).toBe(0)
    expect(staticExport.status, staticExport.output).toBe(0)

    expect(existsSync(join(server.starter, 'src/proxy.ts'))).toBe(true)
    expect(existsSync(join(staticExport.starter, 'src/proxy.ts'))).toBe(false)
  })

  test('조각을 더하지 않은 지점의 Next.js 파일(proxy, instrumentation-client)은 만들지 않는다', () => {
    const result = dcgenNew([])
    expect(result.status, result.output).toBe(0)

    expect(existsSync(join(result.starter, 'src/proxy.ts'))).toBe(false)
    expect(existsSync(join(result.starter, 'src/instrumentation-client.ts'))).toBe(false)
    expect(readdirSync(result.starter)).not.toContain('extensions.json')
  })

  test.each(['server', 'static-export'])(
    'Rendering Mode %s: 서버가 백엔드로 보내는 요청이 거치는 조립 파일(backendFetch)은 조각이 없어도 Base의 apiFetch가 쓰므로 늘 만든다',
    (renderingMode) => {
      const result = dcgenNew(['--rendering-mode', renderingMode])
      expect(result.status, result.output).toBe(0)

      expect(existsSync(join(result.starter, 'src/shared/api/backend-fetch.ts'))).toBe(true)
    },
  )

  test('고른 순서와 상관없이 같은 Starter를 만든다', () => {
    const forward = dcgenNew(FIXTURES, 'forward')
    const backward = dcgenNew(['--recipe', 'extension-b-fixture', '--recipe', 'extension-a-fixture'], 'backward')
    expect(forward.status, forward.output).toBe(0)
    expect(backward.status, backward.output).toBe(0)

    expect(readTree(forward.starter)).toEqual(readTree(backward.starter))
  })

  test('선언한 모듈이 Starter에 없으면 어느 Recipe의 어느 선언인지 알리며 실패하고 만들던 Starter를 남기지 않는다', () => {
    const result = dcgenNew(['--recipe', 'broken-extension-fixture'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Recipe broken-extension-fixture')
    expect(result.output).toContain('src/shared/missing/missing-provider.tsx')
    expect(readdirSync(workdir)).toEqual([])
  })

  test('조각이 조립 파일이 쓰는 이름을 내보내면 무엇을 만들기 전에 실패한다', () => {
    const result = dcgenNew(['--recipe', 'reserved-name-fixture'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Recipe reserved-name-fixture')
    expect(result.output).toContain('AppShell')
    expect(result.output).toContain('src/app/app-shell.tsx')
    expect(readdirSync(workdir)).toEqual([])
  })
})

// 하네스 매트릭스: 같은 확장 지점을 모두 쓰는 시험용 Recipe 둘을 함께 켠 Starter를 Rendering Mode마다 설치해, Starter의 스크립트와
// 시험용 Recipe가 넣은 테스트(명세 조각의 fetch 함수, e2e/extension-points.spec.ts)가 통과하는지 본다.
describe.each(['server', 'static-export'] as const)('Rendering Mode %s에 시험용 Recipe 둘을 함께 켠 Starter', (renderingMode) => {
  const starter = useStarter({
    prefix: `dcgen-extension-points-${renderingMode}-`,
    create: (cwd) => {
      const created = run(
        inject('dcgenWithFixturesBin'),
        ['new', 'my-app', '--rendering-mode', renderingMode, ...FIXTURES, '--skip-install'],
        cwd,
      )
      expect(created.status, created.output).toBe(0)
      return join(cwd, 'my-app')
    },
    install: true,
    playwright: true,
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트(서버의 요청이 backendFetch 처리기를 order 순으로 거침)를 통과하고, 병합된 명세로 api:gen을 다시 실행해도 재생성 계층이 바뀌지 않는다', () => {
    for (const script of [['run', 'typecheck'], ['run', 'lint'], ['run', 'format:check']]) {
      starter.expectNpmSuccess(script)
    }
    const report = runVitestScript(starter, ['test'])
    expectFileToPass(report, 'backend-fetch.server.test.ts', 1)

    const generated = join(starter.dir, 'src/shared/api/generated')
    const before = readTree(generated)
    starter.expectNpmSuccess(['run', 'api:gen'])
    expect(readTree(generated)).toEqual(before)
  })

  test('빌드를 통과하고, 빌드한 앱에서 E2E(Provider·머리글·next.config·instrumentation-client의 순서)가 통과한다', async () => {
    starter.expectNpmSuccess(['run', 'build'])

    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })

  // 위 빌드 결과를 next start로 띄운다. static-export에는 요청을 받는 서버가 없다.
  describe.runIf(renderingMode === 'server')('빌드한 서버', () => {
    let server: BackgroundProcess
    let origin: string

    beforeAll(async () => {
      const port = await freePort()
      origin = `http://localhost:${String(port)}`
      server = start('npm', ['run', 'start', '--', '--port', String(port)], starter.dir, { API_MOCKING: 'enabled' })
      await waitForServer(origin, server)
    })

    afterAll(async () => {
      await server.stop()
    })

    test('instrumentation 조각은 서버가 뜰 때 order 순으로 하나씩 끝까지 실행된다', () => {
      const output = server.output()
      const b = output.indexOf('[extension-b-fixture] register')
      const a = output.indexOf('[extension-a-fixture] register')

      expect(b, output).toBeGreaterThan(-1)
      expect(a, output).toBeGreaterThan(b)
    })

    test('proxy 처리기는 order 순으로 이어지고, 앞의 처리기가 직접 응답하면 뒤의 처리기와 라우트는 실행되지 않는다', async () => {
      const page = await fetch(`${origin}/`)
      expect(page.status).toBe(200)
      // b(order 100)가 a(order 200)에 넘기고, a가 라우트의 응답에 먼저 덧붙인 뒤 b가 덧붙인다.
      expect(page.headers.get('x-fixture-proxy')).toBe('a, b')

      const stopped = await fetch(`${origin}/fixture-proxy-stop`)
      expect(stopped.status).toBe(204)
      expect(stopped.headers.get('x-fixture-proxy-stopped-by')).toBe('b')
      expect(stopped.headers.get('x-fixture-proxy')).toBeNull()
    })

    test('proxy 처리기가 next(request)로 고쳐 넘긴 요청을 뒤의 처리기가 받는다', async () => {
      // b가 요청에 x-fixture-from-b 헤더를 더해 넘기고, a가 그 헤더를 보고 직접 응답한다.
      const response = await fetch(`${origin}/fixture-proxy-request`)

      expect(response.status).toBe(204)
      expect(response.headers.get('x-fixture-seen')).toBe('b')
    })
  })
})
