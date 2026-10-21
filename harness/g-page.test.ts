import { copyFileSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, test } from 'vitest'
import { freePort, type RunResult } from './run.ts'
import { addOperations } from './schematic.ts'
import {
  dcgen,
  expectFilesToMatchSnapshots,
  expectFileToPass,
  readTree,
  restoreBeforeEach,
  runVitestScript,
  SAMPLE_PRODUCTS,
  type Starter,
  useStarter,
} from './starter.ts'

// 생성 결과 스냅샷. Starter의 src 아래 경로 그대로 둔다.
const SNAPSHOTS = './__snapshots__/g-page'

// page Schematic이 읽고 쓰는 곳. 페이지는 라우트(src/app/<route>/)에, --query의 결과를 보여 줄 컴포넌트는 Feature에 만들고,
// queryOptions는 Query Domain에서, 폼은 Feature에서 찾는다.
const APP_DIR = 'src/app'
const FEATURES_DIR = 'src/features'
const QUERIES_DIR = 'src/queries'

// 하네스가 Starter에 넣는 파일: 등록한 상품이 목록에 더해지는 MSW 핸들러와, 만든 화면을 검사하는 E2E(Rendering Mode마다)
const FIXTURES = join(import.meta.dirname, 'fixtures/g-page')
const MOCK_HANDLERS = 'src/shared/mocks/handlers.ts'
const CHAIN_SPEC = 'e2e/page-chain.spec.ts'

const PAGE_MODES = ['ssr', 'ssg', 'isr', 'streaming', 'csr'] as const

// Base의 샘플 명세(openapi.yaml)에 하네스가 더하는 operation. 샘플의 products(listProducts, createProduct)는 그대로 두고 다음을 더한다.
// - 경로 파라미터를 받는 상세 GET → 동적 세그먼트([productId])의 라우트
// - 필수 쿼리 파라미터를 받는 GET → 페이지가 넘길 값이 없어 끼워 넣지 않는다
const HARNESS_OPERATIONS = `
tags: []
paths:
  /products/{productId}:
    get:
      operationId: getProduct
      summary: 상품 상세
      tags: [products]
      parameters:
        - name: productId
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: 상품
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
              example:
                id: 1
                name: 기본 티셔츠
                price: 19000
  /product-search:
    get:
      operationId: searchProducts
      summary: 상품 검색
      tags: [products]
      parameters:
        - name: q
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 검색한 상품
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Product'
components:
  schemas: {}
`

/** Starter 안에서 Schematic을 실행하고 성공했는지 확인한다. */
function generate(starter: Starter, args: readonly string[]): RunResult {
  const result = dcgen(starter, ['g', ...args])
  expect(result.status, result.output).toBe(0)
  return result
}

/** page Schematic이 바꿀 수 있는 곳(라우트와 Feature) */
function pagesTree(starter: Starter) {
  return { app: readTree(join(starter.dir, APP_DIR)), features: readTree(join(starter.dir, FEATURES_DIR)) }
}

/**
 * Schematic을 차례로 실행해 화면을 만든다. Base의 샘플 Query Domain을 지우고 query Schematic으로 queries의 queryOptions를 다시
 * 만든 뒤(같은 코드가 나온다: dark-mode.test.ts), 상품 등록의 뮤테이션 훅과 폼을 만들고, pages마다 page Schematic을 실행한다.
 */
function generateScreens(starter: Starter, queries: readonly string[], pages: readonly (readonly string[])[]): void {
  rmSync(join(starter.dir, QUERIES_DIR, 'products'), { recursive: true })
  for (const operationId of queries) generate(starter, ['query', operationId])
  generate(starter, ['mutation', 'createProduct'])
  generate(starter, ['form', 'createProduct', '--feature', 'product-admin'])
  for (const page of pages) generate(starter, ['page', ...page])
}

/** 하네스가 Starter에 넣는 파일(FIXTURES)을 넣는다. 개발자가 화면에 맞게 목과 E2E를 쓰는 상황을 흉내 낸다. */
function writeChainFixtures(starter: Starter, spec: 'server.spec.ts' | 'static-export.spec.ts'): void {
  copyFileSync(join(FIXTURES, 'handlers.ts'), join(starter.dir, MOCK_HANDLERS))
  copyFileSync(join(FIXTURES, spec), join(starter.dir, CHAIN_SPEC))
}

/** 화면을 만든 Starter가 타입 검사, lint, 포맷 검사를 통과하고, --query로 만든 컴포넌트의 테스트가 실제로 돌아 통과하는지 본다. */
function expectScreensToPassStarterChecks(starter: Starter, viewTests: readonly string[]): void {
  for (const script of ['typecheck', 'lint', 'format:check']) starter.expectNpmSuccess(['run', script])
  const unit = runVitestScript(starter, ['test'])
  for (const file of viewTests) expectFileToPass(unit, file, 1)
}

// 목 빌드(API_MOCKING=enabled)와 배포용 빌드(Starter의 .env.production대로 MSW를 끈 빌드)의 환경 변수. 하네스를 띄운 셸에
// API_BASE_URL이나 API_MOCKING이 있어도 결과가 같도록 덮는다. API_BASE_URL의 빈 값은 없는 것으로 보고, undefined는 넘기지 않는다.
const MOCK_BUILD_ENV = { API_MOCKING: 'enabled', API_BASE_URL: '' }
const DEPLOY_BUILD_ENV = { API_MOCKING: undefined, API_BASE_URL: '' }

// 목 빌드가 빌드 출력에 남기는 경고(src/shared/api/api-mocking.ts)와, 배포용 빌드에 백엔드 주소가 없을 때의 오류(base-url.ts)
const MOCK_BUILD_WARNING = 'API_MOCKING=enabled로 빌드합니다'
const MISSING_BUILD_API_BASE_URL = 'API_BASE_URL 환경 변수가 없습니다. 빌드할 때 데이터를 가져오는 페이지'

/**
 * 배포용 빌드는 빌드할 때 데이터를 가져오는 페이지(page)를 렌더링하다가, 백엔드 주소가 없다고 알리며 실패한다.
 * 목 빌드로 가는 길(API_MOCKING=enabled)도 함께 알린다.
 */
function expectDeployBuildToRequireApiBaseUrl(starter: Starter, page: string): void {
  const build = starter.npm(['run', 'build'], DEPLOY_BUILD_ENV)

  expect(build.status, build.failureMessage).not.toBe(0)
  expect(build.output).toContain(`Error occurred prerendering page "${page}"`)
  expect(build.output).toContain(MISSING_BUILD_API_BASE_URL)
  expect(build.output).toContain('API_MOCKING=enabled')
}

/** directory 아래 JavaScript 파일 가운데 text를 담은 파일. 빌드 결과의 브라우저 번들을 볼 때 쓴다. */
function scriptsContaining(directory: string, text: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((script) => readFileSync(script, 'utf8').includes(text))
}

// MSW(msw/node, msw/browser)와 Starter가 MSW를 켜는 코드가 함께 쓰는 옵션 이름. 속성 이름이라 압축해도 번들에 남는다.
const MSW_MARKER = 'onUnhandledFrame'

/** next build가 보여 주는 라우트 표에서 route의 줄. 라우트를 미리 렌더링했는지(○, ●) 요청마다 렌더링하는지(ƒ) 보여 준다. */
function routeLine(buildOutput: string, route: string): string {
  return buildOutput.split('\n').find((line) => line.trim().split(/\s+/).includes(route)) ?? ''
}

describe('server Starter', () => {
  const starter = useStarter({ prefix: 'dcgen-g-page-', install: true, playwright: true })

  beforeAll(() => {
    addOperations(starter, HARNESS_OPERATIONS)
  })
  // 테스트마다 라우트, Feature, Query Domain, 목, E2E를 생성 직후 상태(Base의 샘플만 있는 상태)로 되돌린다.
  restoreBeforeEach(starter, [APP_DIR, FEATURES_DIR, QUERIES_DIR, 'src/shared/mocks', 'e2e'])

  test('dcgen g page는 라우트에 메타데이터를 담은 페이지와 로딩 상태, 오류 상태를 만들고, --mode가 없으면 SSR로 만든다', async () => {
    const result = generate(starter, ['page', 'notices'])

    expect(result.output).toContain('/notices 페이지(SSR)')
    expect(Object.keys(readTree(join(starter.dir, APP_DIR, 'notices'))).sort()).toEqual([
      'error.tsx',
      'loading.tsx',
      'page.tsx',
    ])
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, 'src', [
      'app/notices/page.tsx',
      'app/notices/loading.tsx',
      'app/notices/error.tsx',
    ])
  })

  test('--mode로 Rendering Mode를 고르고, --query의 queryOptions로 가져온 결과를 Feature의 컴포넌트로 보여 준다', async () => {
    for (const mode of PAGE_MODES) {
      const result = generate(starter, ['page', `modes/${mode}`, '--query', 'listProducts', '--feature', 'catalog', '--mode', mode])
      // 결과를 보여 줄 컴포넌트는 처음 만든 뒤로 다시 쓴다.
      if (mode !== PAGE_MODES[0]) expect(result.output).toContain('Feature에 있던 ListProductsView')
      // 빌드할 때 데이터를 가져오는 모드는 빌드 환경에 백엔드 주소가 필요하다고 알린다.
      expect(result.output.includes('API_BASE_URL'), result.output).toBe(mode === 'ssg' || mode === 'isr')
    }

    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, 'src', [
      ...PAGE_MODES.map((mode) => `app/modes/${mode}/page.tsx`),
      'features/catalog/list-products-view.tsx',
      'features/catalog/list-products-view.test.tsx',
    ])
  })

  test('경로 파라미터를 받는 --query는 같은 이름의 동적 세그먼트에서 값을 읽어 넘기고, SSG·ISR이면 빌드할 때 만들 경로를 비워 둔다', async () => {
    generate(starter, ['query', 'getProduct'])

    generate(starter, ['page', 'products/[productId]', '--query', 'getProduct', '--feature', 'product-detail'])
    generate(starter, [
      'page',
      'products/[productId]/cached',
      '--query',
      'getProduct',
      '--feature',
      'product-detail',
      '--mode',
      'isr',
    ])

    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, 'src', [
      'app/products/[productId]/page.tsx',
      'app/products/[productId]/cached/page.tsx',
      'features/product-detail/get-product-view.tsx',
      'features/product-detail/get-product-view.test.tsx',
    ])
  })

  test('npm run g -- page --form은 form Schematic이 만든 폼을 넣고, --query와 함께 쓰면 목록 아래에 둔다', async () => {
    generate(starter, ['mutation', 'createProduct'])
    generate(starter, ['form', 'createProduct', '--feature', 'product-admin'])

    starter.expectNpmSuccess(['run', 'g', '--', 'page', 'products/new', '--form', 'createProduct'])
    generate(starter, ['page', 'catalog', '--query', 'listProducts', '--form', 'createProduct', '--feature', 'catalog'])

    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, 'src', ['app/products/new/page.tsx', 'app/catalog/page.tsx'])
  })

  test('--form의 폼이 여러 Feature에 있으면 --feature로 고르게 하고, 고른 Feature의 폼을 넣는다', () => {
    generate(starter, ['mutation', 'createProduct'])
    for (const feature of ['product-admin', 'quick-register']) {
      generate(starter, ['form', 'createProduct', '--feature', feature])
    }
    const before = pagesTree(starter)

    const ambiguous = dcgen(starter, ['g', 'page', 'products/new', '--form', 'createProduct'])

    expect(ambiguous.status).not.toBe(0)
    expect(ambiguous.output).toContain('CreateProductForm가 여러 Feature에 있습니다: product-admin, quick-register')
    expect(pagesTree(starter)).toEqual(before)

    generate(starter, ['page', 'products/new', '--form', 'createProduct', '--feature', 'quick-register'])

    expect(readTree(join(starter.dir, APP_DIR, 'products/new'))['page.tsx']).toContain(
      "import { CreateProductForm } from '@/features/quick-register/create-product-form'",
    )
  })

  test.each([
    {
      problem: 'queryOptions를 아직 만들지 않은 --query',
      args: ['products/[productId]', '--query', 'getProduct', '--feature', 'product-detail'],
      reason: 'getProductQueryOptions가 없습니다. 페이지는 이 queryOptions로 데이터를 가져오므로 먼저 npm run g -- query getProduct로 만드세요',
    },
    {
      problem: '폼을 아직 만들지 않은 --form',
      args: ['products/new', '--form', 'createProduct'],
      reason: '먼저 npm run g -- form createProduct --feature <feature>로 만드세요',
    },
    {
      problem: '결과를 보여 줄 Feature를 고르지 않은 --query',
      args: ['catalog', '--query', 'listProducts'],
      reason: '--query의 결과를 보여 줄 컴포넌트를 둘 Feature를 고르세요: --feature <feature>',
    },
    {
      problem: '경로 파라미터와 같은 이름의 동적 세그먼트가 없는 라우트',
      setup: ['query', 'getProduct'],
      args: ['products/detail', '--query', 'getProduct', '--feature', 'product-detail'],
      reason: '라우트에 같은 이름의 동적 세그먼트([productId])가 있어야 합니다(예: products/[productId])',
    },
    {
      problem: '경로 파라미터 말고 필수 인자가 있는 --query',
      setup: ['query', 'searchProducts'],
      args: ['search', '--query', 'searchProducts', '--feature', 'search'],
      reason: 'searchProducts의 params는 필수 인자입니다',
    },
    {
      problem: 'GET이 아닌 --query',
      args: ['catalog', '--query', 'createProduct', '--feature', 'catalog'],
      reason: '--query에는 데이터를 가져올 GET operation을 지정합니다',
    },
    {
      problem: '없는 Rendering Mode',
      args: ['catalog', '--mode', 'spa'],
      reason: "쓸 수 없는 Rendering Mode입니다: 'spa'. ssr, ssg, isr, streaming, csr 가운데 하나를 고르세요",
    },
    {
      problem: 'kebab-case가 아닌 세그먼트',
      args: ['Products/new-arrivals'],
      reason: "쓸 수 없는 라우트입니다: 'Products/new-arrivals'(Products)",
    },
  ])('$problem: 이유를 알리고 아무 파일도 만들지 않은 채 실패한다', ({ setup, args, reason }) => {
    if (setup !== undefined) generate(starter, setup)
    const before = pagesTree(starter)

    const result = dcgen(starter, ['g', 'page', ...args])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain(reason)
    expect(pagesTree(starter)).toEqual(before)
  })

  test('같은 이름의 파일이 하나라도 있으면 덮어쓰지 않고 겹치는 파일을 알린 뒤 아무 파일도 만들지 않는다', () => {
    // 개발자가 결과를 보여 줄 컴포넌트와 같은 파일 이름으로 먼저 쓴 코드
    starter.writeFile(`${FEATURES_DIR}/catalog/list-products-view.tsx`, 'export const listProductsView = 1\n')
    const before = pagesTree(starter)

    const existingPage = dcgen(starter, ['g', 'page', 'products'])
    const existingView = dcgen(starter, ['g', 'page', 'catalog', '--query', 'listProducts', '--feature', 'catalog'])

    expect(existingPage.status).not.toBe(0)
    expect(existingPage.output).toContain('src/app/products/page.tsx')
    expect(existingView.status).not.toBe(0)
    expect(existingView.output).toContain('src/features/catalog/list-products-view.tsx')
    expect(pagesTree(starter)).toEqual(before)
  })

  // 하네스 매트릭스: 샘플 명세로 query → mutation → form → page를 차례로 실행해 만든 화면이 Starter의 검사와 빌드를 통과하고,
  // 빌드한 앱에서 목록을 보여 주고 폼을 제출하면 목록이 바뀌는지 E2E(harness/fixtures/g-page/server.spec.ts)로 본다.
  // 빌드는 GitLab CI의 build 잡처럼 목 빌드로 하고, 빌드용 백엔드는 띄우지 않는다. 목을 끈 배포용 빌드는 백엔드 주소를 요구한다.
  test('query → mutation → form → page로 만든 화면이 Starter의 검사, 빌드, E2E(목록 표시, 폼 제출 뒤 목록 갱신)를 통과한다', {
    timeout: 20 * 60_000,
  }, async () => {
    generateScreens(
      starter,
      ['listProducts', 'getProduct'],
      [
        ['products/new', '--form', 'createProduct'],
        ['catalog', '--query', 'listProducts', '--form', 'createProduct', '--feature', 'catalog'],
        ...PAGE_MODES.map((mode) => [`modes/${mode}`, '--query', 'listProducts', '--feature', 'catalog', '--mode', mode]),
        ['products/[productId]', '--query', 'getProduct', '--feature', 'product-detail'],
        ['products/[productId]/cached', '--query', 'getProduct', '--feature', 'product-detail', '--mode', 'isr'],
      ],
    )
    writeChainFixtures(starter, 'server.spec.ts')

    expectScreensToPassStarterChecks(starter, [
      'src/features/catalog/list-products-view.test.tsx',
      'src/features/product-detail/get-product-view.test.tsx',
    ])

    // 배포용 빌드는 빌드할 때 상품 목록을 가져오는 SSG·ISR 페이지에서 백엔드 주소가 없다고 알리며 실패한다.
    expectDeployBuildToRequireApiBaseUrl(starter, '/modes/isr')

    // 목 빌드는 빌드할 때의 요청에 MSW가 응답해 실제 백엔드 없이 빌드된다(GitLab CI의 build 잡과 같다).
    const build = starter.expectNpmSuccess(['run', 'build'], MOCK_BUILD_ENV)
    expect(build.output).toContain(MOCK_BUILD_WARNING)
    for (const route of ['/products/new', '/catalog', '/modes/ssr', '/modes/streaming', '/products/[productId]']) {
      expect(routeLine(build.output, route), build.output).toContain('ƒ')
    }
    for (const route of ['/modes/ssg', '/modes/csr']) expect(routeLine(build.output, route), build.output).toContain('○')
    expect(routeLine(build.output, '/modes/isr'), build.output).toMatch(/○.*1m/)
    expect(routeLine(build.output, '/products/[productId]/cached'), build.output).toContain('●')
    // SSG·ISR 페이지는 빌드할 때 MSW가 돌려준 상품 목록을 HTML에 담았다. 동적 세그먼트의 ISR 페이지는 빌드할 때 렌더링하지 않는다.
    for (const route of ['modes/ssg', 'modes/isr']) {
      const html = readFileSync(join(starter.dir, '.next/server/app', `${route}.html`), 'utf8')
      for (const { name } of SAMPLE_PRODUCTS) expect(html, route).toContain(name)
    }
    // 서버의 apiFetch가 빌드할 때 MSW를 켜는 코드와 MSW는 브라우저 번들에 들어가지 않는다.
    expect(scriptsContaining(join(starter.dir, '.next/static'), MSW_MARKER)).toEqual([])

    // 위 빌드 결과를 next start로 띄워 검사한다(playwright.config.ts). 서버는 MSW로 요청을 받는다.
    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })
})

// static-export Starter에서는 요청을 받는 서버 없이 동작하는 모드(SSG, CSR)만 쓰고, 기본은 CSR이다. dark-mode Recipe를 함께 넣어
// 머리글(테마 전환)이 있는 화면에서도 만든 화면이 동작하는지 본다.
describe('static-export Starter에 dark-mode Recipe를 넣은 Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-g-page-static-dark-',
    renderingMode: 'static-export',
    recipes: ['dark-mode'],
    install: true,
    playwright: true,
  })
  restoreBeforeEach(starter, [APP_DIR, FEATURES_DIR, QUERIES_DIR, 'src/shared/mocks', 'e2e'])

  test.each([
    { mode: 'ssr', label: 'SSR' },
    { mode: 'isr', label: 'ISR' },
    { mode: 'streaming', label: '스트리밍' },
  ])('요청을 받는 서버가 있어야 하는 $label은 이유와 함께 거부하고 아무 파일도 만들지 않는다', ({ mode, label }) => {
    const before = pagesTree(starter)

    const result = dcgen(starter, ['g', 'page', 'catalog', '--mode', mode])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain(`static-export Starter에서는 ${label} 페이지를 만들 수 없습니다`)
    expect(result.output).toContain('ssg, csr 가운데 하나를 고르세요')
    expect(pagesTree(starter)).toEqual(before)
  })

  test('빌드할 때 모든 경로를 정해야 하는 동적 세그먼트의 라우트는 만들지 않는다', () => {
    const before = pagesTree(starter)

    const result = dcgen(starter, ['g', 'page', 'products/[productId]', '--mode', 'ssg'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('동적 세그먼트([productId])가 있는 라우트를 만들지 않습니다')
    expect(pagesTree(starter)).toEqual(before)
  })

  test('--mode가 없으면 페이지 뼈대를 미리 만들고 데이터는 브라우저가 가져오는 CSR로 만든다', () => {
    const result = generate(starter, ['page', 'catalog', '--query', 'listProducts', '--feature', 'catalog'])

    expect(result.output).toContain('/catalog 페이지(CSR)')
    const page = readTree(join(starter.dir, APP_DIR, 'catalog'))['page.tsx'] ?? ''
    expect(page).toContain('<ListProductsView />')
    expect(page).not.toContain('getQueryClient')
  })

  // 하네스 매트릭스: server Starter와 같은 차례로 만든 화면을, E2E(harness/fixtures/g-page/static-export.spec.ts)가 브라우저의
  // MSW를 켜고 다시 빌드한 정적 파일에서 검사한다(playwright.config.ts). SSG 페이지가 그 빌드에서 보내는 요청에는 MSW가 응답한다.
  // 그 전에 배포용 빌드와 목 빌드(GitLab CI의 build 잡)가 빌드할 때의 요청을 어떻게 다루는지 본다.
  test('query → mutation → form → page로 만든 화면이 Starter의 검사와 E2E(목록 표시, 폼 제출 뒤 목록 갱신)를 통과한다', {
    timeout: 20 * 60_000,
  }, async () => {
    generateScreens(
      starter,
      ['listProducts'],
      [
        ['products/new', '--form', 'createProduct'],
        ['catalog', '--query', 'listProducts', '--form', 'createProduct', '--feature', 'catalog'],
        ['modes/ssg', '--query', 'listProducts', '--feature', 'catalog', '--mode', 'ssg'],
      ],
    )
    writeChainFixtures(starter, 'static-export.spec.ts')

    expectScreensToPassStarterChecks(starter, ['src/features/catalog/list-products-view.test.tsx'])

    // 배포용 빌드는 빌드할 때 상품 목록을 가져오는 SSG 페이지에서 백엔드 주소가 없다고 알리며 실패한다.
    expectDeployBuildToRequireApiBaseUrl(starter, '/modes/ssg')

    // 목 빌드(GitLab CI의 build 잡)는 실제 백엔드 없이 빌드되고, SSG 페이지는 MSW가 돌려준 상품 목록을 HTML에 담는다.
    // 브라우저의 MSW는 켜지 않았으므로(.env.production의 NEXT_PUBLIC_API_MOCKING=disabled) out/에 들어가지 않는다.
    const build = starter.expectNpmSuccess(['run', 'build'], MOCK_BUILD_ENV)
    expect(build.output).toContain(MOCK_BUILD_WARNING)
    const html = readFileSync(join(starter.dir, 'out/modes/ssg.html'), 'utf8')
    for (const { name } of SAMPLE_PRODUCTS) expect(html).toContain(name)
    expect(scriptsContaining(join(starter.dir, 'out/_next'), MSW_MARKER)).toEqual([])

    // E2E는 빌드할 때와 브라우저의 MSW를 모두 켜고 다시 빌드한 out/으로 돈다(playwright.config.ts). 빌드용 백엔드는 띄우지 않는다.
    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()), API_BASE_URL: '' })
  })
})
