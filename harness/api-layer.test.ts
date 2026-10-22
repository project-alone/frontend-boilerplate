import { cpSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { type BackgroundProcess, freePort, start, waitForServer } from './run.ts'
import { addOperations } from './schematic.ts'
import { MSW_PROBE_ROUTE, readTree, SAMPLE_PRODUCTS, useStarter, writeMswProbePage } from './starter.ts'

// Starter 하나를 만들어 설치해 두고, 테스트마다 다시 설치하지 않도록 이 파일의 모든 테스트가 함께 쓴다.
const starter = useStarter({ prefix: 'dcgen-api-layer-', install: true })

const GENERATED_DIR = 'src/shared/api/generated'

/** body를 실행한 뒤 Starter의 paths(Starter 최상위 기준)를 실행하기 전으로 되돌린다. 같은 Starter를 쓰는 다음 테스트에 남기지 않는다. */
function restoringAfter(paths: readonly string[], body: () => void): void {
  const backup = join(starter.workdir, 'backup')
  for (const path of paths) cpSync(join(starter.dir, path), join(backup, path), { recursive: true })

  try {
    body()
  } finally {
    for (const path of paths) {
      rmSync(join(starter.dir, path), { recursive: true, force: true })
      cpSync(join(backup, path), join(starter.dir, path), { recursive: true })
    }
    rmSync(backup, { recursive: true, force: true })
  }
}

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

// 속성이 컴포넌트의 string enum을 $ref로 가리키는 명세 조각(#78). 실제 명세처럼 상태 값을 컴포넌트로 따로 두고 여러 곳에서 가리킨다.
// 필수 속성, 선택 속성, 배열의 항목이 모두 $ref enum이고, example이 없어 faker가 목을 만든다.
const TICKET_OPERATIONS = `
tags:
  - name: tickets
    description: 문의
paths:
  /tickets:
    get:
      operationId: listTickets
      tags: [tickets]
      responses:
        '200':
          description: 문의 목록
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Ticket'
components:
  schemas:
    TicketStatus:
      type: string
      enum: [open, answered, closed]
    TicketChannel:
      type: string
      enum: [email, phone, chat]
    Ticket:
      type: object
      required: [id, status]
      properties:
        id:
          type: integer
        status:
          $ref: '#/components/schemas/TicketStatus'
        channel:
          $ref: '#/components/schemas/TicketChannel'
        statusHistory:
          type: array
          items:
            $ref: '#/components/schemas/TicketStatus'
`

// $ref enum 속성이 있는 응답을 생성된 fetch 함수(Zod 검증)와 목 함수로 확인하는 Starter 테스트. 기대하는 값은 명세의 enum 값을 그대로 적는다.
const TICKETS_TEST = `import { expect, test } from 'vitest'
import { listTickets } from '@/shared/api/generated'
import { Ticket } from '@/shared/api/generated/model'
import { getListTicketsResponseMock } from '@/shared/api/generated/tickets/tickets.msw'

const STATUSES = ['open', 'answered', 'closed']
const CHANNELS = ['email', 'phone', 'chat']

test('MSW 핸들러가 돌려준 $ref enum 속성이 있는 응답이 fetch 함수의 Zod 검증을 통과한다', async () => {
  expect((await listTickets()).length).toBeGreaterThan(0)
})

test('목은 $ref enum 속성에 명세의 enum 값만 넣는다', () => {
  const tickets = Array.from({ length: 50 }, () => getListTicketsResponseMock()).flat()

  for (const ticket of tickets) {
    expect(Ticket.parse(ticket)).toEqual(ticket)
    expect(STATUSES).toContain(ticket.status)
    if (ticket.channel !== undefined) expect(CHANNELS).toContain(ticket.channel)
    for (const status of ticket.statusHistory ?? []) expect(STATUSES).toContain(status)
  }
})
`

// 실제 고객사 명세처럼 응답 스키마에 선택 속성(required에 없는 속성)이 있는 명세 조각(#75). Base의 샘플 명세에 더한다.
// 문자열, 배열, enum, 중첩 객체(그 안의 선택 속성), null을 받는 선택 속성과, 선택 속성만 있는 인라인 응답이 섞여 있다.
// listReviews와 getReviewStats는 example이 없어 faker가 목을 만들고, getReview의 example은 선택 속성을 적지 않았다.
const REVIEW_OPERATIONS = `
tags:
  - name: reviews
    description: 리뷰
paths:
  /reviews:
    get:
      operationId: listReviews
      tags: [reviews]
      responses:
        '200':
          description: 리뷰 목록
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Review'
  /reviews/{reviewId}:
    get:
      operationId: getReview
      tags: [reviews]
      parameters:
        - name: reviewId
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: 리뷰
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Review'
              example:
                id: 7
                rating: 5
  /review-stats:
    get:
      operationId: getReviewStats
      tags: [reviews]
      responses:
        '200':
          description: 리뷰 통계
          content:
            application/json:
              schema:
                type: object
                properties:
                  count:
                    type: integer
                  average:
                    type: number
components:
  schemas:
    Review:
      type: object
      required: [id, rating]
      properties:
        id:
          type: integer
        rating:
          type: integer
        comment:
          type: string
        tags:
          type: array
          items:
            type: string
        status:
          type: string
          enum: [draft, published]
        author:
          type: object
          required: [name]
          properties:
            name:
              type: string
            email:
              type: string
            nickname:
              type: [string, 'null']
`

// 선택 속성이 있는 응답을 생성된 fetch 함수(Zod 검증)와 목 함수로 확인하는 Starter 테스트. 목 함수가 돌려준 값은 JSON을 거치지 않으므로,
// 선택 속성에 undefined가 들어 있으면 .exactOptional()로 만든 Zod 스키마가 거부한다.
const REVIEWS_TEST = `import { expect, test } from 'vitest'
import { getReview, getReviewStats, listReviews } from '@/shared/api/generated'
import { GetReviewStats200, Review } from '@/shared/api/generated/model'
import { getGetReviewStatsResponseMock, getListReviewsResponseMock } from '@/shared/api/generated/reviews/reviews.msw'

test('MSW 핸들러가 돌려준 선택 속성이 있는 응답이 fetch 함수의 Zod 검증을 통과한다', async () => {
  expect(await getReview(7)).toEqual({ id: 7, rating: 5 })
  expect((await listReviews()).length).toBeGreaterThan(0)
  expect(await getReviewStats()).toBeTypeOf('object')
})

test('목은 선택 속성을 값과 함께 넣거나 키째 빼고 undefined를 넣지 않는다', () => {
  const reviews = Array.from({ length: 50 }, () => getListReviewsResponseMock()).flat()
  const authors = reviews.flatMap((review) => (review.author === undefined ? [] : [review.author]))
  const stats = Array.from({ length: 50 }, () => getGetReviewStatsResponseMock())

  for (const review of reviews) expect(Review.parse(review)).toEqual(review)
  for (const stat of stats) expect(GetReviewStats200.parse(stat)).toEqual(stat)
  const samples: [readonly object[], string][] = [
    [reviews, 'comment'],
    [reviews, 'tags'],
    [reviews, 'status'],
    [reviews, 'author'],
    [authors, 'email'],
    [stats, 'average'],
  ]
  for (const [objects, key] of samples) {
    expect(objects.some((object) => key in object), key).toBe(true)
    expect(objects.some((object) => !(key in object)), key).toBe(true)
  }
})
`

// 응답 스키마가 이름 있는 스키마가 아니라 그 자리에 적은 oneOf·anyOf인 명세 조각(#79). Base의 샘플 명세에 더한다.
// getPayment는 이름 있는 스키마 둘의 oneOf, listPayments는 그런 oneOf의 배열, getLatestPayment는 이름 있는 스키마와 null의 anyOf다.
// getPayment만 example이 있고 나머지는 faker가 목을 만든다.
const PAYMENT_OPERATIONS = `
tags:
  - name: payments
    description: 결제
paths:
  /payments:
    get:
      operationId: listPayments
      tags: [payments]
      responses:
        '200':
          description: 결제 목록
          content:
            application/json:
              schema:
                type: array
                items:
                  oneOf:
                    - $ref: '#/components/schemas/CardPayment'
                    - $ref: '#/components/schemas/BankPayment'
  /payments/{paymentId}:
    get:
      operationId: getPayment
      tags: [payments]
      parameters:
        - name: paymentId
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: 결제
          content:
            application/json:
              schema:
                oneOf:
                  - $ref: '#/components/schemas/CardPayment'
                  - $ref: '#/components/schemas/BankPayment'
              example:
                method: card
                cardNumber: '1234-5678'
  /latest-payment:
    get:
      operationId: getLatestPayment
      tags: [payments]
      responses:
        '200':
          description: 가장 최근 결제. 결제가 없으면 null
          content:
            application/json:
              schema:
                anyOf:
                  - $ref: '#/components/schemas/CardPayment'
                  - type: 'null'
components:
  schemas:
    CardPayment:
      type: object
      required: [method, cardNumber]
      properties:
        method:
          type: string
          enum: [card]
        cardNumber:
          type: string
    BankPayment:
      type: object
      required: [method, account]
      properties:
        method:
          type: string
          enum: [bank]
        account:
          type: string
`

// oneOf·anyOf 응답을 생성된 fetch 함수로 받는 Starter 테스트. 응답이 어느 스키마에도 맞지 않으면 fetch 함수가 거부해야
// 응답을 Zod 스키마로 검증한 것이다.
const PAYMENTS_TEST = `import { http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import { z } from 'zod'
import { getLatestPayment, getPayment, listPayments } from '@/shared/api/generated'
import { server } from '@/shared/mocks/node'

test('MSW 핸들러가 돌려준 oneOf·anyOf 응답이 fetch 함수의 Zod 검증을 통과한다', async () => {
  expect(await getPayment(7)).toEqual({ method: 'card', cardNumber: '1234-5678' })
  const payments = await listPayments()
  expect(payments.length).toBeGreaterThan(0)
  for (const payment of payments) expect(['card', 'bank']).toContain(payment.method)
  const latest = await getLatestPayment()
  expect([null, 'card']).toContain(latest?.method ?? null)
})

test('fetch 함수는 oneOf·anyOf의 어느 스키마에도 맞지 않는 응답을 거부한다', async () => {
  server.use(
    http.get('*/payments/:paymentId', () => HttpResponse.json({ method: 'cash' })),
    http.get('*/payments', () => HttpResponse.json([{ method: 'card', account: '110-123' }])),
    http.get('*/latest-payment', () => HttpResponse.json({ method: 'bank', account: '110-123' })),
  )

  await expect(getPayment(7)).rejects.toThrow(z.ZodError)
  await expect(listPayments()).rejects.toThrow(z.ZodError)
  await expect(getLatestPayment()).rejects.toThrow(z.ZodError)
})
`

describe('api:gen', () => {
  test('Starter에 담긴 재생성 결과는 샘플 명세로 api:gen을 다시 실행해도 바뀌지 않는다', () => {
    const before = readTree(join(starter.dir, GENERATED_DIR))
    expect(Object.keys(before)).not.toEqual([])

    starter.expectNpmSuccess(['run', 'api:gen'])

    expect(readTree(join(starter.dir, GENERATED_DIR))).toEqual(before)
  })

  test('명세를 바꾸면 api:gen이 타입, fetch 함수, Zod 스키마, MSW 핸들러를 다시 만들고 TanStack Query 훅은 만들지 않는다', () => {
    restoringAfter(['src', 'e2e', 'openapi.yaml'], () => {
      writeFileSync(join(starter.dir, 'openapi.yaml'), ORDERS_SPEC)
      for (const path of SAMPLE_CODE) rmSync(join(starter.dir, path), { recursive: true })
      starter.expectNpmSuccess(['run', 'api:gen'])
      writeFileSync(join(starter.dir, 'src/shared/api/orders.test.ts'), ORDERS_TEST)

      starter.expectNpmSuccess(['run', 'typecheck'])
      starter.expectNpmSuccess(['test', '--', 'src/shared/api/orders.test.ts'])
      const generated = Object.values(readTree(join(starter.dir, GENERATED_DIR))).join('\n')
      expect(generated).not.toContain('@tanstack/react-query')
    })
  })

  test('속성이 $ref string enum을 가리키는 명세 조각으로 다시 만든 MSW 목은 명세의 enum 값만 돌려주고 fetch 함수의 Zod 검증을 통과한다', () => {
    restoringAfter(['src', 'openapi.yaml'], () => {
      addOperations(starter, TICKET_OPERATIONS)
      writeFileSync(join(starter.dir, 'src/shared/api/tickets.test.ts'), TICKETS_TEST)

      // 목이 Zod enum 객체의 속성 값(Object.values)에서 골라 typecheck는 통과하고 응답의 Zod 검증만 invalid_value로 실패했다(#78).
      starter.expectNpmSuccess(['run', 'typecheck'])
      starter.expectNpmSuccess(['test', '--', 'src/shared/api/tickets.test.ts'])
    })
  })

  test('응답 스키마에 선택 속성이 있는 명세 조각으로 다시 만든 MSW 목도 Starter의 typecheck·lint·테스트를 통과하고, 선택 속성은 값과 함께 넣거나 키째 뺀다', () => {
    restoringAfter(['src', 'openapi.yaml'], () => {
      addOperations(starter, REVIEW_OPERATIONS)
      writeFileSync(join(starter.dir, 'src/shared/api/reviews.test.ts'), REVIEWS_TEST)

      // 가장 엄격한 설정(exactOptionalPropertyTypes)에서 목이 선택 속성에 undefined를 넣으면 TS2322·TS2375로 실패한다(#75).
      starter.expectNpmSuccess(['run', 'typecheck'])
      starter.expectNpmSuccess(['run', 'lint'])
      starter.expectNpmSuccess(['test', '--', 'src/shared/api/reviews.test.ts'])
    })
  })

  test('응답 스키마가 그 자리에 적은 oneOf·anyOf인 명세 조각으로 다시 만들어도 Starter의 typecheck·lint·테스트를 통과하고, fetch 함수가 응답을 Zod 스키마로 검증한다', () => {
    restoringAfter(['src', 'openapi.yaml'], () => {
      addOperations(starter, PAYMENT_OPERATIONS)
      writeFileSync(join(starter.dir, 'src/shared/api/payments.test.ts'), PAYMENTS_TEST)

      // orval이 이런 응답의 Zod 스키마를 만들지 않으면 fetch 함수가 schema 없이 options(ApiRequestInit<unknown>)를 넘겨 TS2379로 실패한다(#79).
      starter.expectNpmSuccess(['run', 'typecheck'])
      starter.expectNpmSuccess(['run', 'lint'])
      starter.expectNpmSuccess(['test', '--', 'src/shared/api/payments.test.ts'])
    })
  })

  test('재생성 결과는 lint와 format:check 대상에서 빠진다', () => {
    // 손으로 고치지 않는 재생성 계층에는 린트·포맷 규칙을 어기는 코드가 있어도 된다.
    const file = join(starter.dir, GENERATED_DIR, 'harness-unformatted.ts')
    writeFileSync(file, 'export const value: any = "따옴표와 세미콜론";\n')

    try {
      starter.expectNpmSuccess(['run', 'lint'])
      starter.expectNpmSuccess(['run', 'format:check'])
    } finally {
      rmSync(file)
    }
  })
})

// MSW를 끈 서버에 API_BASE_URL이 없을 때 Starter가 내는 오류(src/shared/api/base-url.ts)
const MISSING_API_BASE_URL_MESSAGE = 'API_BASE_URL 환경 변수가 없습니다'

// 샘플 명세의 listProducts example. 개발 서버와 E2E 대상 서버는 MSW가 이 값을 돌려준다.
const SAMPLE_PRODUCT_NAMES = SAMPLE_PRODUCTS.map(({ name }) => name)

describe('빌드한 Starter', () => {
  beforeAll(() => {
    starter.expectNpmSuccess(['run', 'build'])
  })

  test('서버 컴포넌트가 prefetch한 데이터를 브라우저가 다시 요청하지 않고 hydration으로 이어받는다(Starter의 E2E)', async () => {
    starter.expectNpmSuccess(['run', 'playwright:install'])

    starter.expectNpmSuccess(['run', 'test:e2e', '--', 'e2e/products.spec.ts'], { E2E_PORT: String(await freePort()) })
  })

  describe('실제 백엔드로 바꾼 서버(API_MOCKING=disabled)', () => {
    let backend: FakeBackend
    let app: BackgroundProcess
    let appUrl: string

    beforeAll(async () => {
      backend = await startFakeBackend()
      const port = await freePort()
      appUrl = `http://localhost:${String(port)}`
      app = start('npm', ['run', 'start', '--', '--port', String(port)], starter.dir, {
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

  test('MSW를 끄고 API_BASE_URL을 넣지 않은 서버는 요청을 처리하지 않고 무엇을 넣어야 하는지 알린다', async () => {
    const port = await freePort()
    // 하네스를 띄운 셸에 API_BASE_URL이 있어도 결과가 같도록 빈 값으로 덮는다(빈 값은 없는 것으로 본다).
    const app = start('npm', ['run', 'start', '--', '--port', String(port)], starter.dir, {
      API_MOCKING: 'disabled',
      API_BASE_URL: '',
    })

    try {
      const response = await waitForServer(`http://localhost:${String(port)}/products`, app)

      expect(response.status, app.output()).toBe(500)
      expect(app.output()).toContain(MISSING_API_BASE_URL_MESSAGE)
    } finally {
      await app.stop()
    }
  })
})

describe('개발 서버', () => {
  test('.env.development.local에서 MSW만 끄고 API_BASE_URL을 빠뜨리면 개발 서버가 무엇을 넣어야 하는지 알리고 멈춘다', async () => {
    const envFile = join(starter.dir, '.env.development.local')
    writeFileSync(envFile, 'API_MOCKING=disabled\n')
    const port = await freePort()
    const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter.dir, { API_BASE_URL: '' })

    try {
      const exitCode = await Promise.race([devServer.exited, setTimeout(120_000, '2분이 지나도 실행 중')])

      expect(exitCode, devServer.output()).not.toBe(0)
      expect(exitCode, devServer.output()).not.toBe('2분이 지나도 실행 중')
      expect(devServer.output()).toContain(MISSING_API_BASE_URL_MESSAGE)
    } finally {
      await devServer.stop()
      rmSync(envFile)
    }
  })

  test('npm run dev만 실행하면 서버 컴포넌트와 BFF 프록시를 거친 요청 모두 MSW가 돌려준 샘플 명세의 응답을 받는다', async () => {
    const port = await freePort()
    const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter.dir)

    try {
      const page = await waitForServer(`http://localhost:${String(port)}/products`, devServer)

      expect(page.status, devServer.output()).toBe(200)
      const html = await page.text()
      for (const name of SAMPLE_PRODUCT_NAMES) expect(html).toContain(name)

      const proxied = await fetch(`http://localhost:${String(port)}/api/proxy/products`)
      expect(proxied.status, devServer.output()).toBe(200)
      // 브라우저의 apiFetch는 content-type을 보고 JSON으로 읽으므로, MSW가 돌려준 응답의 헤더도 그대로 넘어와야 한다.
      expect(proxied.headers.get('content-type')).toContain('application/json')
      const products = (await proxied.json()) as { name: string }[]
      expect(products.map(({ name }) => name)).toEqual(SAMPLE_PRODUCT_NAMES)
    } finally {
      await devServer.stop()
    }
  })

  // #65: 개발 서버는 고친 코드 때문에 라우트의 서버 번들을 다시 쓰면(새 모듈을 import하거나, 컴파일 오류를 고치거나, .env 파일을
  // 고칠 때 등) globalThis.fetch를 서버가 뜰 때의 값, 곧 instrumentation이 MSW를 켜기 전의 fetch로 되돌린다. 그 뒤로도 서버가
  // 보내는 요청을 MSW가 받아야 한다. 모듈의 내용만 고치면 서버 번들을 다시 쓰지 않고 바꿔 넣으므로 이 경우가 드러나지 않는다.
  // 되돌린 뒤에도 Node.js의 fetch(undici)는 MSW가 이미 받은 목 백엔드 연결을 keep-alive 동안(4초) 다시 써서 요청이 MSW에 닿으므로,
  // 그보다 오래 쉬었다가 새 연결로 보내는 요청을 본다.
  test('페이지가 새 모듈을 import하게 고친 뒤에도 서버 컴포넌트와 BFF 프록시가 보내는 요청을 MSW가 받는다', async () => {
    writeMswProbePage(starter)
    const port = await freePort()
    const appUrl = `http://localhost:${String(port)}`
    const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter.dir)

    try {
      const before = await waitForServer(`${appUrl}${MSW_PROBE_ROUTE}`, devServer)
      expect(before.status, devServer.output()).toBe(200)
      expect(await before.text()).toContain(SAMPLE_PRODUCT_NAMES[0])

      const label = '모듈을 더한 탐침 페이지'
      writeMswProbePage(starter, label)
      await waitForEdit(`${appUrl}${MSW_PROBE_ROUTE}`, label, devServer)
      await setTimeout(6_000)

      const edited = await fetch(`${appUrl}${MSW_PROBE_ROUTE}`)
      expect(edited.status, devServer.output()).toBe(200)
      expect(await edited.text()).toContain(SAMPLE_PRODUCT_NAMES[0])
      const page = await fetch(`${appUrl}/products`)
      expect(page.status, devServer.output()).toBe(200)
      const html = await page.text()
      for (const name of SAMPLE_PRODUCT_NAMES) expect(html).toContain(name)
      const proxied = await fetch(`${appUrl}/api/proxy/products`)
      expect(proxied.status, devServer.output()).toBe(200)
      const products = (await proxied.json()) as { name: string }[]
      expect(products.map(({ name }) => name)).toEqual(SAMPLE_PRODUCT_NAMES)
    } finally {
      await devServer.stop()
      rmSync(join(starter.dir, `src/app${MSW_PROBE_ROUTE}`), { recursive: true, force: true })
    }
  })
})

/**
 * 개발 서버가 고친 코드를 반영할 때까지 url을 다시 요청한다. 응답 본문에 text가 담기거나 200이 아닌 응답이 오면 끝난다.
 * 파일을 고친 직후에는 개발 서버가 아직 고치기 전의 코드로 응답할 수 있다.
 */
async function waitForEdit(url: string, text: string, server: Pick<BackgroundProcess, 'output'>): Promise<void> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const response = await fetch(url)
    if (response.status !== 200 || (await response.text()).includes(text)) return
    await setTimeout(500)
  }
  throw new Error(`개발 서버가 1분 안에 고친 코드를 반영하지 않았습니다(${url}).\n${server.output()}`)
}

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
