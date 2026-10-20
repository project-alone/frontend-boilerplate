import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { parse, stringify } from 'yaml'
import { run, type RunResult } from './run.ts'
import { readTree, type Starter, useStarter } from './starter.ts'

const QUERIES_DIR = 'src/queries'

// 생성 결과 스냅샷. Starter의 코드이므로 하네스의 타입 검사 대상에서 뺀다(tsconfig.json).
const SNAPSHOTS = './__snapshots__/g-query'

// Base의 샘플 명세(openapi.yaml)에 하네스가 더하는 operation. 샘플의 products는 그대로 두고 다음을 더한다.
// - products tag에 상세 operation(path 파라미터) → 손으로 쓴 샘플 Query Domain에 끼워 넣기
// - orders tag에 페이지 번호 쿼리 파라미터가 있는 목록 operation과 상세 operation → 새 Query Domain, infiniteQueryOptions
// - 여러 단어로 된 tag(`Sales Stats`)에 파라미터 없는 operation → Query Domain 이름을 kebab-case로 정하기
const HARNESS_OPERATIONS = `
tags:
  - name: orders
    description: 주문
  - name: Sales Stats
    description: 매출 통계
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
  /orders:
    get:
      operationId: listOrders
      summary: 주문 목록
      tags: [orders]
      parameters:
        - name: status
          in: query
          required: false
          schema:
            type: string
            enum: [pending, paid]
        - name: page
          in: query
          description: 1부터 시작하는 페이지 번호
          required: false
          schema:
            type: integer
            minimum: 1
      responses:
        '200':
          description: 주문 목록
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Order'
              example:
                - id: 7
                  status: paid
                  total: 42000
  /orders/{orderId}:
    get:
      operationId: getOrder
      summary: 주문 상세
      tags: [orders]
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: 주문
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
              example:
                id: 7
                status: paid
                total: 42000
  /stats/sales:
    get:
      operationId: getSalesStats
      summary: 매출 통계
      tags: [Sales Stats]
      responses:
        '200':
          description: 매출 통계
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SalesStats'
              example:
                orderCount: 12
                revenue: 504000
components:
  schemas:
    Order:
      type: object
      required: [id, status, total]
      properties:
        id:
          type: integer
        status:
          type: string
          enum: [pending, paid]
        total:
          type: integer
    SalesStats:
      type: object
      required: [orderCount, revenue]
      properties:
        orderCount:
          type: integer
        revenue:
          type: integer
`

interface Spec {
  tags: unknown[]
  paths: Record<string, unknown>
  components: { schemas: Record<string, unknown> }
}

/** Starter의 openapi.yaml에 HARNESS_OPERATIONS를 더하고(포맷 검사를 통과하도록 Prettier로 다시 쓴다) API 계층을 다시 만든다. */
function addHarnessOperations(starter: Starter): void {
  const path = join(starter.dir, 'openapi.yaml')
  const spec = parse(readFileSync(path, 'utf8')) as Spec
  const additions = parse(HARNESS_OPERATIONS) as Spec
  spec.tags.push(...additions.tags)
  Object.assign(spec.paths, additions.paths)
  Object.assign(spec.components.schemas, additions.components.schemas)
  writeFileSync(path, stringify(spec))
  const formatted = run('npx', ['--no', '--', 'prettier', '--write', 'openapi.yaml'], starter.dir)
  expect(formatted.status, formatted.output).toBe(0)
  starter.expectNpmSuccess(['run', 'api:gen'])
}

/** Starter 안에서 Starter에 설치된 Generator의 `dcgen`을 실행한다. `--`가 없으면 npm이 인자의 옵션을 가로챈다. */
function dcgen(starter: Starter, args: readonly string[]): RunResult {
  return run('npx', ['--no', '--', 'dcgen', ...args], starter.dir)
}

/** Query Domain의 쿼리 키 모듈과 쿼리 모듈이 스냅샷과 같은지 본다. */
async function expectQueryDomainToMatchSnapshots(starter: Starter, domain: string): Promise<void> {
  for (const file of [`${domain}.keys.ts`, `${domain}.queries.ts`]) {
    const source = readFileSync(join(starter.dir, QUERIES_DIR, domain, file), 'utf8')
    await expect(source).toMatchFileSnapshot(`${SNAPSHOTS}/${file}`)
  }
}

// HARNESS_OPERATIONS의 operation을 모두 query Schematic으로 만드는 순서
const ALL_QUERIES = [['getSalesStats'], ['getProduct'], ['listOrders'], ['listOrders', '--infinite'], ['getOrder']]

// 생성된 queryOptions가 재생성 계층의 fetch 함수와 MSW 핸들러로 실제로 동작하는지 보는 Starter 테스트
const ORDERS_QUERIES_TEST = `import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getListOrdersMockHandler } from '@/shared/api/generated/orders/orders.msw'
import { server } from '@/shared/mocks/node'
import { getOrderQueryOptions, listOrdersInfiniteQueryOptions } from './orders.queries'

// static-export Starter는 브라우저가 백엔드를 직접 부르므로 그 요청을 MSW가 받게 한다. server Starter는 이 값을 읽지 않는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test('queryOptions는 재생성 계층의 fetch 함수로 가져온 데이터를 계층형 쿼리 키에 담는다', async () => {
  const queryClient = new QueryClient()
  const options = getOrderQueryOptions(7)

  const order = await queryClient.query(options)

  expect(options.queryKey).toEqual(['orders', 'getOrder', 7])
  expect(order).toEqual({ id: 7, status: 'paid', total: 42000 })
})

test('infiniteQueryOptions는 첫 페이지부터 페이지 번호를 하나씩 늘려 다음 페이지를 가져온다', async () => {
  const requested: string[] = []
  server.use(
    getListOrdersMockHandler(({ request }) => {
      requested.push(new URL(request.url).search)
      return [{ id: 7, status: 'paid', total: 42000 }]
    }),
  )
  const queryClient = new QueryClient()
  const options = listOrdersInfiniteQueryOptions({ status: 'paid' })

  const data = await queryClient.infiniteQuery({ ...options, pages: 2 })

  expect(options.queryKey).toEqual(['orders', 'listOrders', 'infinite', { status: 'paid' }])
  expect(data.pageParams).toEqual([1, 2])
  expect(requested).toEqual(['?status=paid&page=1', '?status=paid&page=2'])
})
`

/** HARNESS_OPERATIONS의 쿼리를 모두 만들고, 그 쿼리를 쓰는 테스트를 더한 Starter가 Starter 자신의 검사를 통과하는지 본다. */
function expectGeneratedQueriesToPassStarterChecks(starter: Starter): void {
  for (const args of ALL_QUERIES) {
    const result = dcgen(starter, ['g', 'query', ...args])
    expect(result.status, result.output).toBe(0)
  }
  starter.writeFile(`${QUERIES_DIR}/orders/orders.harness.test.ts`, ORDERS_QUERIES_TEST)

  for (const script of ['typecheck', 'lint', 'format:check']) starter.expectNpmSuccess(['run', script])
  starter.expectNpmSuccess(['test'])
}

describe('server Starter', () => {
  const starter = useStarter({ prefix: 'dcgen-g-query-', install: true })
  let pristineQueries: string
  const queriesTree = () => readTree(join(starter.dir, QUERIES_DIR))

  beforeAll(() => {
    addHarnessOperations(starter)
    pristineQueries = join(starter.workdir, 'pristine-queries')
    cpSync(join(starter.dir, QUERIES_DIR), pristineQueries, { recursive: true })
  })

  // 테스트마다 src/queries를 생성 직후(Base의 샘플 Query Domain만 있는 상태)로 되돌린다.
  beforeEach(() => {
    rmSync(join(starter.dir, QUERIES_DIR), { recursive: true, force: true })
    cpSync(pristineQueries, join(starter.dir, QUERIES_DIR), { recursive: true })
  })

  test('dcgen g query는 Query Domain 모듈이 없으면 operation의 tag를 kebab-case로 바꾼 이름으로 쿼리 키 모듈과 쿼리 모듈을 만든다', async () => {
    const result = dcgen(starter, ['g', 'query', 'getSalesStats'])

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('src/queries/sales-stats/sales-stats.keys.ts')
    expect(Object.keys(queriesTree()).sort()).toEqual([
      'products/products.keys.ts',
      'products/products.queries.ts',
      'sales-stats/sales-stats.keys.ts',
      'sales-stats/sales-stats.queries.ts',
    ])
    await expectQueryDomainToMatchSnapshots(starter, 'sales-stats')
  })

  test('npm run g -- query는 Query Domain 모듈이 있으면 손으로 쓴 코드를 그대로 두고 그 모듈에 끼워 넣는다', async () => {
    const result = starter.npm(['run', 'g', '--', 'query', 'getProduct'])

    expect(result.status, result.failureMessage).toBe(0)
    await expectQueryDomainToMatchSnapshots(starter, 'products')
  })

  test('목록형 operation은 --infinite로 infiniteQueryOptions를 고를 수 있고, 한 Query Domain의 쿼리는 같은 모듈에 차례로 쌓인다', async () => {
    for (const args of [['listOrders'], ['listOrders', '--infinite'], ['getOrder']]) {
      const result = dcgen(starter, ['g', 'query', ...args])
      expect(result.status, result.output).toBe(0)
    }

    await expectQueryDomainToMatchSnapshots(starter, 'orders')
  })

  test('Base의 샘플 Query Domain은 query Schematic이 만드는 코드와 같다', () => {
    const sample = readTree(join(starter.dir, QUERIES_DIR, 'products'))
    rmSync(join(starter.dir, QUERIES_DIR, 'products'), { recursive: true })

    const result = dcgen(starter, ['g', 'query', 'listProducts'])

    expect(result.status, result.output).toBe(0)
    expect(readTree(join(starter.dir, QUERIES_DIR, 'products'))).toEqual(sample)
  })

  test('같은 이름의 쿼리 키나 queryOptions가 이미 있으면 덮어쓰지 않고 무엇이 겹치는지 알린 뒤 실패한다', () => {
    const before = queriesTree()

    const result = dcgen(starter, ['g', 'query', 'listProducts'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('src/queries/products/products.keys.ts: productsKeys.listProducts')
    expect(result.output).toContain('src/queries/products/products.queries.ts: listProductsQueryOptions')
    expect(queriesTree()).toEqual(before)
  })

  test('겹치는 이름이 쿼리 키 모듈에만 있어도 쿼리 모듈을 포함해 아무 파일도 바꾸지 않는다', () => {
    // 개발자가 손으로 쓴 orders Query Domain. getOrder 키가 이미 있고 쿼리 모듈은 아직 없다.
    starter.writeFile(
      `${QUERIES_DIR}/orders/orders.keys.ts`,
      `export const ordersKeys = {
  all: ['orders'] as const,
  getOrder: (orderId: number) => [...ordersKeys.all, 'detail', orderId] as const,
}
`,
    )
    const before = queriesTree()

    const result = dcgen(starter, ['g', 'query', 'getOrder'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('src/queries/orders/orders.keys.ts: ordersKeys.getOrder')
    expect(queriesTree()).toEqual(before)
  })

  test.each([
    { problem: '명세에 없는 operationId', args: ['listOrderz'], reason: "operationId가 'listOrderz'인 operation이 없습니다" },
    { problem: 'GET이 아닌 operation', args: ['createProduct'], reason: 'GET operation으로만 만듭니다' },
    {
      problem: '배열을 돌려주지 않는 operation의 --infinite',
      args: ['getOrder', '--infinite'],
      reason: '배열을 돌려주는 목록형 operation에만',
    },
    {
      problem: '페이지 번호 쿼리 파라미터가 없는 operation의 --infinite',
      args: ['listProducts', '--infinite'],
      reason: "'page' 쿼리 파라미터가 없습니다",
    },
    {
      problem: '숫자가 아닌 쿼리 파라미터를 페이지 번호로 고른 --infinite',
      args: ['listOrders', '--infinite', '--page-param', 'status'],
      reason: "'status' 쿼리 파라미터는 숫자가 아니어서",
    },
  ])('$problem는 이유를 알리고 아무 파일도 바꾸지 않은 채 실패한다', ({ args, reason }) => {
    const before = queriesTree()

    const result = dcgen(starter, ['g', 'query', ...args])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain(reason)
    expect(queriesTree()).toEqual(before)
  })

  test('query Schematic이 만든 코드로 Starter의 타입 검사, lint, 포맷 검사, 테스트가 모두 통과한다', () => {
    expectGeneratedQueriesToPassStarterChecks(starter)
  })
})

describe('static-export Starter', () => {
  const starter = useStarter({ prefix: 'dcgen-g-query-static-', renderingMode: 'static-export', install: true })

  beforeAll(() => {
    addHarnessOperations(starter)
  })

  test('query Schematic이 만든 코드로 Starter의 타입 검사, lint, 포맷 검사, 테스트가 모두 통과한다', () => {
    expectGeneratedQueriesToPassStarterChecks(starter)
  })
})
