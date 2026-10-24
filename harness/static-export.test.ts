import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, relative } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, inject, test } from 'vitest'
import { freePort, run, start, waitForServer } from './run.ts'
import { MSW_PROBE_ROUTE, runPlaywrightAgainst, SAMPLE_PRODUCTS, useStarter, writeMswProbePage } from './starter.ts'

// static-export Starter 하나를 만들어 설치·빌드해 두고, 테스트마다 다시 설치하지 않도록 모든 테스트가 함께 쓴다.
// server Starter(기본)의 빌드·E2E·Storybook은 test-tools.test.ts가 검증한다.
// 배포용 빌드(beforeAll의 npm run build)를 보는 테스트는 E2E보다 앞에 둔다. E2E가 MSW를 켜고 out/을 다시 빌드한다.
const starter = useStarter({
  prefix: 'dcgen-static-export-',
  renderingMode: 'static-export',
  install: true,
  playwright: true,
})

// 샘플 명세(openapi.yaml)의 listProducts example. MSW가 이 값을 돌려준다.
const SAMPLE_PRODUCT_NAMES = SAMPLE_PRODUCTS.map(({ name }) => name)

beforeAll(() => {
  starter.expectNpmSuccess(['run', 'build'])
})

test('빌드는 페이지를 미리 렌더링한 HTML을 out/에 만든다', () => {
  const html = readFileSync(join(starter.dir, 'out', 'index.html'), 'utf8')

  expect(html).toContain('<h1>Starter</h1>')
})

test('API를 쓰는 샘플 페이지는 데이터 없이 미리 렌더링되고, 배포용 빌드에는 MSW 코드가 들어가지 않는다', () => {
  const html = readFileSync(join(starter.dir, 'out', 'products.html'), 'utf8')
  expect(html).toContain('<h1>상품</h1>')
  for (const name of SAMPLE_PRODUCT_NAMES) expect(html).not.toContain(name)

  // 브라우저의 MSW(msw/browser)는 서비스 워커의 기본 주소를 코드에 담고 있다.
  const scripts = readdirSync(join(starter.dir, 'out', '_next'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => join(entry.parentPath, entry.name))
  expect(scripts.filter((script) => readFileSync(script, 'utf8').includes('mockServiceWorker.js'))).toEqual([])
})

test('Next.js 서버 없이 out/만 정적 파일 서버로 띄워도 페이지를 응답하고, 없는 주소에는 앱의 404 화면을 상태 코드 404로 보낸다', async () => {
  // out/ 밖의 빌드 결과(.next/)를 지워도 동작해야 빌드 결과가 정적 파일로만 이루어진 것이다.
  rmSync(join(starter.dir, '.next'), { recursive: true, force: true })
  const port = await freePort()
  const server = start('npm', ['run', 'start', '--', '--port', String(port)], starter.dir)

  try {
    const home = await waitForServer(`http://localhost:${String(port)}/`, server)
    expect(home.status, server.output()).toBe(200)
    expect(await home.text()).toContain('<h1>Starter</h1>')

    const products = await fetch(`http://localhost:${String(port)}/products`)
    expect(products.status, server.output()).toBe(200)
    expect(await products.text()).toContain('<h1>상품</h1>')

    // 빌드가 앱 수준의 404 화면(src/app/not-found.tsx)으로 만든 out/404.html이다.
    const missing = await fetch(`http://localhost:${String(port)}/no-such-page`)
    expect(missing.status, server.output()).toBe(404)
    expect(await missing.text()).toContain('찾는 화면이 없습니다')
  } finally {
    await server.stop()
  }
})

test('E2E는 정적 파일 서버로 띄운 out/을 대상으로 통과하고, 브라우저가 백엔드에 직접 보낸 요청은 MSW 서비스 워커가 받는다', async () => {
  // Starter의 e2e/products.spec.ts가 MSW가 돌려준 상품 목록이 그려지는지 본다.
  starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
})

test('public/mockServiceWorker.js는 Starter가 고정한 MSW로 다시 만들어도 같다', () => {
  const worker = join(starter.dir, 'public', 'mockServiceWorker.js')
  const packaged = readFileSync(worker, 'utf8')
  rmSync(worker)

  // 인자 없이 실행하면 package.json의 msw.workerDirectory에 서비스 워커를 만든다(README의 "API 목킹(MSW)").
  const result = run('npx', ['--no', 'msw', 'init'], starter.dir)

  expect(result.status, result.output).toBe(0)
  expect(readFileSync(worker, 'utf8')).toBe(packaged)
})

test('static-export Starter의 스토리도 axe 접근성 검사를 모두 통과한다', () => {
  starter.expectNpmSuccess(['run', 'test:storybook'])
})

// Base의 서버 instrumentation(src/instrumentation.ts가 부르는 api-instrumentation.ts)을 static-export Starter에도 두는 이유다.
// 빌드에는 영향이 없고 개발 서버에서만 쓰인다.
test('개발 서버에서는 서버 컴포넌트가 보내는 API 요청을 MSW가 받는다', async () => {
  writeMswProbePage(starter)
  const port = await freePort()
  const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter.dir)

  try {
    const response = await waitForServer(`http://localhost:${port}${MSW_PROBE_ROUTE}`, devServer)

    expect(response.status, devServer.output()).toBe(200)
    // 샘플 명세(openapi.yaml)의 listProducts example
    expect(await response.text()).toContain('기본 티셔츠')
  } finally {
    await devServer.stop()
    rmSync(join(starter.dir, `src/app${MSW_PROBE_ROUTE}`), { recursive: true, force: true })
  }
})

test('개발 서버에서는 브라우저가 백엔드로 보내는 API 요청을 MSW 서비스 워커가 받는다', async () => {
  const port = await freePort()
  const baseURL = `http://localhost:${String(port)}`
  const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter.dir)

  try {
    const response = await waitForServer(`${baseURL}/products`, devServer)
    expect(response.status, devServer.output()).toBe(200)

    // 빌드 결과 대신 이미 떠 있는 개발 서버를 검사한다.
    const result = runPlaywrightAgainst(starter.dir, baseURL, ['e2e/products.spec.ts'])
    expect(result.status, `${result.output}\n${devServer.output()}`).toBe(0)
  } finally {
    await devServer.stop()
  }
})

// #53: 목 백엔드의 경로가 페이지 주소와 같은 Recipe(table의 /members 등)를 넣어도, 브라우저의 MSW가 페이지를 여는 요청에 목
// 응답을 돌려주지 않는다. 목 백엔드는 앱과 다른 출처(MOCK_API_BASE_URL)에 있고, 페이지 탐색 요청은 핸들러가 받지 않는다.
describe('페이지 주소와 같은 경로의 API를 쓰는 Recipe를 넣은 static-export Starter', () => {
  const withRecipes = useStarter({
    prefix: 'dcgen-static-export-mock-pages-',
    renderingMode: 'static-export',
    recipes: ['table', 'chart', 'infinite-list', 'optimistic-update'],
    install: true,
    playwright: true,
  })

  test('MSW 서비스 워커가 켜진 빌드에서 페이지를 직접 열거나 새로 고쳐도 페이지가 열리고 데이터는 목 백엔드에서 온다', async () => {
    withRecipes.writeFile(
      'e2e/mock-api-pages.spec.ts',
      readFileSync(join(import.meta.dirname, 'fixtures/static-export/mock-api-pages.spec.ts'), 'utf8'),
    )

    withRecipes.expectNpmSuccess(['run', 'test:e2e', '--', 'e2e/mock-api-pages.spec.ts'], {
      E2E_PORT: String(await freePort()),
    })
  })
})

// #94: Rendering Mode overlay는 Base 파일을 통째로 대신하지 않고 바꿀 부분만 패치(<경로>.patch)로 고친다(ADR-0007). 대신한
// 사본은 Base를 고쳐도 따라가지 않아 조용히 어긋난다. 하네스가 설치한 Generator를 복사해 Base를 고친 뒤 static-export Starter를
// 만들어 본다. 설치하지 않으므로 금방 끝난다.
describe('Base를 고친 Generator로 만든 static-export Starter', () => {
  let workdir: string
  let generator: string

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'dcgen-static-export-base-edit-'))
    // 같은 node_modules에 두어 Generator의 의존성을 그대로 찾게 한다(global-setup.ts의 시험용 Generator와 같은 방법).
    const source = inject('generatorDir')
    generator = join(dirname(source), `devc-frontend-generator-${basename(workdir)}`)
    cpSync(source, generator, { recursive: true })
  })

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true })
    rmSync(generator, { recursive: true, force: true })
  })

  function dcgenNew() {
    const result = run(
      join(generator, 'dist', 'cli.js'),
      ['new', 'my-app', '--rendering-mode', 'static-export', '--skip-install'],
      workdir,
    )
    return { ...result, starter: join(workdir, 'my-app') }
  }

  // 끝에 주석 한 줄을 덧붙일 수 있는 파일과 그 주석. 병합하는 파일(package.json, README.md, dotenv)은 대신될 일이 없어 뺀다.
  const COMMENTS: Record<string, (text: string) => string> = {
    '.ts': (text) => `// ${text}`,
    '.tsx': (text) => `// ${text}`,
    '.mjs': (text) => `// ${text}`,
    '.css': (text) => `/* ${text} */`,
    '.yml': (text) => `# ${text}`,
    '.yaml': (text) => `# ${text}`,
  }

  test('Base 파일 끝에 더한 줄은 static-export가 지우지 않은 파일에 모두 남는다(static-export가 고치는 파일도 대신하지 않고 패치한다)', () => {
    const baseDir = join(generator, 'base')
    const marker = 'Base에서 더한 줄(하네스)'
    const files = readdirSync(baseDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(baseDir, join(entry.parentPath, entry.name)))
      .filter((path) => COMMENTS[extname(path)] !== undefined)
    for (const path of files) appendFileSync(join(baseDir, path), `\n${COMMENTS[extname(path)]?.(marker) ?? ''}\n`)

    const result = dcgenNew()
    expect(result.status, result.output).toBe(0)

    const kept = files.filter((path) => existsSync(join(result.starter, path)))
    // static-export가 고치는 Base 파일(브라우저가 백엔드를 직접 부르는 base-url.ts, Suspense 없이 상태를 그리는 상품 목록 등)
    expect(kept).toEqual(
      expect.arrayContaining([
        'src/shared/api/base-url.ts',
        'src/features/product-list/product-list.tsx',
        'next.config.ts',
        'config/vitest.setup.ts',
      ]),
    )
    expect(kept.filter((path) => !readFileSync(join(result.starter, path), 'utf8').includes(marker))).toEqual([])
  })

  test('static-export가 고치는 Base 파일의 그 부분이 바뀌면 어느 패치인지 알리며 실패하고 만들던 Starter를 남기지 않는다', () => {
    const file = join(generator, 'base', 'src/features/product-list/product-list.tsx')
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll('useSuspenseQuery', 'useQuery'))

    const result = dcgenNew()

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Rendering Mode static-export')
    expect(result.output).toContain('src/features/product-list/product-list.tsx.patch')
    expect(readdirSync(workdir)).toEqual([])
  })
})
