import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, test } from 'vitest'
import { type BackgroundProcess, freePort, run, start, waitForServer } from './run.ts'

// Starter 하나를 만들어 설치해 두고, 테스트마다 다시 설치하지 않도록 이 파일의 모든 테스트가 함께 쓴다.
let workdir: string
let starter: string

const GENERATED_DIR = 'src/shared/api/generated'

function npm(args: readonly string[], env?: NodeJS.ProcessEnv) {
  const result = run('npm', args, starter, env)
  return { ...result, failureMessage: `npm ${args.join(' ')}\n${result.output}` }
}

function expectNpmSuccess(args: readonly string[], env?: NodeJS.ProcessEnv) {
  const result = npm(args, env)
  expect(result.status, result.failureMessage).toBe(0)
  return result
}

/** 디렉터리 아래 모든 파일을 { 상대 경로: 내용 }으로 읽는다. */
function readTree(directory: string): Record<string, string> {
  const files = readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
  return Object.fromEntries(
    files.map((entry) => {
      const path = join(entry.parentPath, entry.name)
      return [relative(directory, path), readFileSync(path, 'utf8')]
    }),
  )
}

beforeAll(() => {
  workdir = mkdtempSync(join(tmpdir(), 'dcgen-api-layer-'))
  const created = run(inject('dcgenBin'), ['new', 'my-app'], workdir)
  expect(created.status, created.output).toBe(0)
  starter = join(workdir, 'my-app')

  expectNpmSuccess(['install', '--no-audit', '--no-fund'])
})

afterAll(() => {
  rmSync(workdir, { recursive: true, force: true })
})

// 실제 프로젝트가 샘플 명세 대신 쓸 명세. tag가 다르고, example이 있는 응답과 없는 응답이 섞여 있다.
const ORDERS_SPEC = `openapi: 3.1.0
info:
  title: Shop API
  version: 1.0.0
tags:
  - name: orders
paths:
  /orders:
    get:
      operationId: listOrders
      tags: [orders]
      responses:
        '200':
          description: 주문 목록
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Order'
  /orders/{orderId}:
    get:
      operationId: getOrder
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
`

// README의 "샘플 명세 바꾸기"가 지우라고 안내하는 샘플 코드
const SAMPLE_CODE = ['src/app/products', 'src/features/product-list', 'src/queries/products', 'e2e/products.spec.ts']

// 생성된 fetch 함수, Zod 스키마, 타입, MSW 핸들러를 모두 쓰는 Starter 테스트
const ORDERS_TEST = `import { expect, test } from 'vitest'
import { getOrder, listOrders } from '@/shared/api/generated'
import { Order } from '@/shared/api/generated/model'

test('명세에 example이 있으면 MSW 핸들러가 그 값을 돌려준다', async () => {
  const order: Order = await getOrder(7)

  expect(order).toEqual({ id: 7, status: 'paid', total: 42000 })
})

test('example이 없으면 MSW 핸들러가 스키마에 맞는 값을 만들어 돌려준다', async () => {
  const orders = await listOrders()

  expect(Array.isArray(orders)).toBe(true)
  for (const order of orders) expect(Order.parse(order)).toEqual(order)
})
`

describe('api:gen', () => {
  test('Starter에 담긴 재생성 결과는 샘플 명세로 api:gen을 다시 실행해도 바뀌지 않는다', () => {
    const before = readTree(join(starter, GENERATED_DIR))
    expect(Object.keys(before)).not.toEqual([])

    expectNpmSuccess(['run', 'api:gen'])

    expect(readTree(join(starter, GENERATED_DIR))).toEqual(before)
  })

  test('명세를 바꾸면 api:gen이 타입, fetch 함수, Zod 스키마, MSW 핸들러를 다시 만들고 TanStack Query 훅은 만들지 않는다', () => {
    const backup = join(workdir, 'backup')
    cpSync(join(starter, 'src'), join(backup, 'src'), { recursive: true })
    cpSync(join(starter, 'e2e'), join(backup, 'e2e'), { recursive: true })
    cpSync(join(starter, 'openapi.yaml'), join(backup, 'openapi.yaml'))

    try {
      writeFileSync(join(starter, 'openapi.yaml'), ORDERS_SPEC)
      for (const path of SAMPLE_CODE) rmSync(join(starter, path), { recursive: true })
      expectNpmSuccess(['run', 'api:gen'])
      writeFileSync(join(starter, 'src/shared/api/orders.test.ts'), ORDERS_TEST)

      expectNpmSuccess(['run', 'typecheck'])
      expectNpmSuccess(['test', '--', 'src/shared/api/orders.test.ts'])
      const generated = Object.values(readTree(join(starter, GENERATED_DIR))).join('\n')
      expect(generated).not.toContain('@tanstack/react-query')
    } finally {
      for (const path of ['src', 'e2e', 'openapi.yaml']) {
        rmSync(join(starter, path), { recursive: true, force: true })
        cpSync(join(backup, path), join(starter, path), { recursive: true })
      }
      rmSync(backup, { recursive: true, force: true })
    }
  })

  test('재생성 결과는 lint와 format:check 대상에서 빠진다', () => {
    // 손으로 고치지 않는 재생성 계층에는 린트·포맷 규칙을 어기는 코드가 있어도 된다.
    const file = join(starter, GENERATED_DIR, 'harness-unformatted.ts')
    writeFileSync(file, 'export const value: any = "따옴표와 세미콜론";\n')

    try {
      expectNpmSuccess(['run', 'lint'])
      expectNpmSuccess(['run', 'format:check'])
    } finally {
      rmSync(file)
    }
  })
})

// 샘플 명세의 listProducts example. 개발 서버와 E2E 대상 서버는 MSW가 이 값을 돌려준다.
const SAMPLE_PRODUCT_NAMES = ['기본 티셔츠', '데님 재킷']

describe('빌드한 Starter', () => {
  beforeAll(() => {
    expectNpmSuccess(['run', 'build'])
  })

  test('서버 컴포넌트가 prefetch한 데이터를 브라우저가 다시 요청하지 않고 hydration으로 이어받는다(Starter의 E2E)', async () => {
    expectNpmSuccess(['run', 'playwright:install'])

    expectNpmSuccess(['run', 'test:e2e', '--', 'e2e/products.spec.ts'], { E2E_PORT: String(await freePort()) })
  })

  describe('실제 백엔드로 바꾼 서버(API_MOCKING=disabled)', () => {
    let backend: FakeBackend
    let app: BackgroundProcess
    let appUrl: string

    beforeAll(async () => {
      backend = await startFakeBackend()
      const port = await freePort()
      appUrl = `http://localhost:${String(port)}`
      app = start('npm', ['run', 'start', '--', '--port', String(port)], starter, {
        API_MOCKING: 'disabled',
        API_BASE_URL: backend.url,
      })
      await waitForServer(appUrl, app)
    })

    afterAll(async () => {
      await app.stop()
      await backend.close()
    })

    test('서버 컴포넌트는 API_BASE_URL의 백엔드를 직접 부른다', async () => {
      const response = await fetch(`${appUrl}/products`)

      expect(response.status, app.output()).toBe(200)
      expect(await response.text()).toContain(BACKEND_PRODUCT.name)
      expect(backend.requests).toContainEqual(expect.objectContaining({ method: 'GET', url: '/products' }))
    })

    test('BFF 프록시는 요청과 응답을 바꾸지 않고 백엔드와 주고받는다', async () => {
      const response = await fetch(`${appUrl}/api/proxy/orders/7/memo?lang=ko&tag=a&tag=b`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-request-id': 'harness-7' },
        body: JSON.stringify({ memo: '문 앞에 놓아 주세요' }),
      })

      expect(backend.requests.at(-1)).toMatchObject({
        method: 'PUT',
        url: '/orders/7/memo?lang=ko&tag=a&tag=b',
        headers: { 'content-type': 'application/json', 'x-request-id': 'harness-7' },
        body: JSON.stringify({ memo: '문 앞에 놓아 주세요' }),
      })
      expect(response.status).toBe(ECHO_STATUS)
      expect(response.headers.get('x-backend')).toBe('fake')
      expect(await response.json()).toEqual({ echoed: JSON.stringify({ memo: '문 앞에 놓아 주세요' }) })
    })
  })
})

describe('개발 서버', () => {
  test('npm run dev만 실행하면 서버 컴포넌트와 BFF 프록시를 거친 요청 모두 MSW가 돌려준 샘플 명세의 응답을 받는다', async () => {
    const port = await freePort()
    const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter)

    try {
      const page = await waitForServer(`http://localhost:${String(port)}/products`, devServer)

      expect(page.status, devServer.output()).toBe(200)
      const html = await page.text()
      for (const name of SAMPLE_PRODUCT_NAMES) expect(html).toContain(name)

      const proxied = await fetch(`http://localhost:${String(port)}/api/proxy/products`)
      expect(proxied.status, devServer.output()).toBe(200)
      const products = (await proxied.json()) as { name: string }[]
      expect(products.map(({ name }) => name)).toEqual(SAMPLE_PRODUCT_NAMES)
    } finally {
      await devServer.stop()
    }
  })
})

// 실제 백엔드 대신 띄우는 HTTP 서버. 받은 요청을 기록하고, GET /products에는 상품 목록을, 나머지에는 받은 본문을
// 2xx가 아닌 상태와 함께 그대로 돌려준다.
const BACKEND_PRODUCT = { id: 100, name: '백엔드가 보낸 상품', price: 1000 }
const ECHO_STATUS = 418

interface ReceivedRequest {
  method: string
  url: string
  headers: IncomingHttpHeaders
  body: string
}

interface FakeBackend {
  url: string
  requests: ReceivedRequest[]
  close: () => Promise<void>
}

async function startFakeBackend(): Promise<FakeBackend> {
  const requests: ReceivedRequest[] = []
  const server = createServer((request, response) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => (body += chunk))
    request.on('end', () => {
      const { method = '', url = '', headers } = request
      requests.push({ method, url, headers, body })
      if (method === 'GET' && url === '/products') {
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify([BACKEND_PRODUCT]))
        return
      }
      response
        .writeHead(ECHO_STATUS, { 'content-type': 'application/json', 'x-backend': 'fake' })
        .end(JSON.stringify({ echoed: body }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('가짜 백엔드의 주소를 읽지 못했습니다.')

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
