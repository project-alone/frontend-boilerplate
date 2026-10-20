import { cpSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { addOperations } from './schematic.ts'
import { dcgen, readTree, type Starter, useStarter } from './starter.ts'

const QUERIES_DIR = 'src/queries'

// 생성 결과 스냅샷. Starter의 코드이므로 하네스의 타입 검사 대상에서 뺀다(tsconfig.json).
const SNAPSHOTS = './__snapshots__/g-mutation'

// Base의 샘플 명세(openapi.yaml)에 하네스가 더하는 operation. 샘플의 products(listProducts, createProduct)는 그대로 두고 다음을 더한다.
// - products tag에 path 파라미터와 요청 본문을 받는 PUT, path 파라미터만 받고 응답 본문이 없는 DELETE
//   → 손으로 쓴 샘플 Query Domain에 끼워 넣기, 인자가 여럿인 뮤테이션과 인자가 하나인 뮤테이션
// - cart tag(Query Domain 모듈이 없다)에 인자가 없는 DELETE, 요청 본문만 받는 POST, 조회 GET
//   → 새 Query Domain, 인자가 없는 뮤테이션, 낙관적 업데이트
const HARNESS_OPERATIONS = `
tags:
  - name: cart
    description: 장바구니
paths:
  /products/{productId}:
    put:
      operationId: updateProduct
      summary: 상품 수정
      tags: [products]
      parameters:
        - name: productId
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/NewProduct'
      responses:
        '200':
          description: 수정된 상품
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
    delete:
      operationId: deleteProduct
      summary: 상품 삭제
      tags: [products]
      parameters:
        - name: productId
          in: path
          required: true
          schema:
            type: integer
      responses:
        '204':
          description: 삭제됨
  /cart:
    get:
      operationId: getCart
      summary: 장바구니
      tags: [cart]
      responses:
        '200':
          description: 장바구니
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Cart'
              example:
                items:
                  - productId: 1
                    quantity: 2
    delete:
      operationId: clearCart
      summary: 장바구니 비우기
      tags: [cart]
      responses:
        '204':
          description: 비움
  /cart/items:
    post:
      operationId: addCartItem
      summary: 장바구니에 상품 담기
      tags: [cart]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CartItem'
      responses:
        '200':
          description: 담은 뒤의 장바구니
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Cart'
              example:
                items:
                  - productId: 1
                    quantity: 2
components:
  schemas:
    Cart:
      type: object
      required: [items]
      properties:
        items:
          type: array
          items:
            $ref: '#/components/schemas/CartItem'
    CartItem:
      type: object
      required: [productId, quantity]
      properties:
        productId:
          type: integer
        quantity:
          type: integer
          minimum: 1
`

/** Query Domain 모듈이 스냅샷과 같은지 본다. 스냅샷 이름은 파일 이름이고, 같은 파일의 다른 결과는 directory로 나눈다. */
async function expectModulesToMatchSnapshots(starter: Starter, files: readonly string[], directory = ''): Promise<void> {
  for (const file of files) {
    const [domain] = file.split('.')
    const source = readFileSync(join(starter.dir, QUERIES_DIR, domain ?? '', file), 'utf8')
    await expect(source).toMatchFileSnapshot(join(SNAPSHOTS, directory, file))
  }
}

// HARNESS_OPERATIONS와 샘플 명세의 뮤테이션을 모두 만드는 순서. 인자가 하나, 여럿, 없는 뮤테이션과
// 인자가 없는 쿼리, 인자를 받는 쿼리를 고치는 낙관적 업데이트를 모두 담는다.
const ALL_SCHEMATICS = [
  ['mutation', 'createProduct'],
  ['mutation', 'updateProduct', '--optimistic', 'listProducts'],
  ['mutation', 'deleteProduct'],
  ['mutation', 'clearCart'],
  ['query', 'getCart'],
  ['mutation', 'addCartItem', '--optimistic', 'getCart'],
]

// --optimistic이 만든 뼈대에서 응답 전에 보일 값을 만드는 함수(apply<OperationId>). 생성 직후에는 캐시를 그대로 두고,
// 개발자가 비즈니스 판단을 채운다. 하네스는 Starter 테스트 전에 개발자처럼 채운다: 담은 상품을 장바구니 끝에 더하고,
// 수정한 상품을 목록에서 바꾼다.
const OPTIMISTIC_SKELETON = '= (current) => current'
const OPTIMISTIC_UPDATES = {
  'cart/cart.queries.ts': '= (current, cartItem) => ({ ...current, items: [...current.items, cartItem] })',
  'products/products.queries.ts':
    '= (current, { productId, newProduct }) => current.map((product) => (product.id === productId ? { ...product, ...newProduct } : product))',
}

// --optimistic의 뼈대를 채운 뮤테이션 훅이 응답 전에 캐시를 고치고, 끝나면 다시 가져오고, 실패하면 되돌리는지 보는 Starter 테스트
const CART_MUTATIONS_TEST = `import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getAddCartItemMockHandler, getGetCartMockHandler } from '@/shared/api/generated/cart/cart.msw'
import type { Cart } from '@/shared/api/generated/model'
import { server } from '@/shared/mocks/node'
import { getCartQueryOptions, useAddCartItemMutation } from './cart.queries'

// static-export Starter는 브라우저가 백엔드를 직접 부르므로 그 요청을 MSW가 받게 한다. server Starter는 이 값을 읽지 않는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function wrapperWith(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

test('응답을 기다리는 동안 쿼리의 캐시를 미리 고치고, 끝나면 서버의 값으로 다시 가져온다', async () => {
  // 서버는 같은 상품을 담으면 수량을 합친다. 화면은 응답 전까지 낙관적 값(줄 하나 더)을 보여 준다.
  let serverCart: Cart = { items: [{ productId: 1, quantity: 2 }] }
  const response = Promise.withResolvers<undefined>()
  server.use(
    getGetCartMockHandler(() => serverCart),
    getAddCartItemMockHandler(async () => {
      await response.promise
      serverCart = { items: [{ productId: 1, quantity: 3 }] }
      return serverCart
    }),
  )
  const { result } = renderHook(
    () => ({ cart: useQuery(getCartQueryOptions()), addCartItem: useAddCartItemMutation() }),
    { wrapper: wrapperWith(new QueryClient()) },
  )
  await waitFor(() => {
    expect(result.current.cart.data).toEqual({ items: [{ productId: 1, quantity: 2 }] })
  })

  act(() => {
    result.current.addCartItem.mutate({ productId: 1, quantity: 1 })
  })

  await waitFor(() => {
    expect(result.current.cart.data).toEqual({
      items: [
        { productId: 1, quantity: 2 },
        { productId: 1, quantity: 1 },
      ],
    })
  })
  response.resolve(undefined)
  await waitFor(() => {
    expect(result.current.cart.data).toEqual({ items: [{ productId: 1, quantity: 3 }] })
  })
})

test('실패하면 미리 고친 캐시를 뮤테이션 전의 값으로 되돌린다', async () => {
  const response = Promise.withResolvers<undefined>()
  server.use(
    http.post('*/cart/items', async () => {
      await response.promise
      return HttpResponse.json({ message: '재고가 없습니다.' }, { status: 409 })
    }),
  )
  // 화면이 보고 있지 않은 쿼리는 무효화해도 다시 가져오지 않으므로, 캐시에 남는 값은 되돌린 값이다.
  const queryClient = new QueryClient()
  const { queryKey } = getCartQueryOptions()
  queryClient.setQueryData(queryKey, { items: [{ productId: 1, quantity: 2 }] })
  const { result } = renderHook(() => useAddCartItemMutation(), { wrapper: wrapperWith(queryClient) })

  act(() => {
    result.current.mutate({ productId: 7, quantity: 1 })
  })

  await waitFor(() => {
    expect(queryClient.getQueryData(queryKey)?.items).toHaveLength(2)
  })
  response.resolve(undefined)
  await waitFor(() => {
    expect(result.current.isError).toBe(true)
  })
  expect(queryClient.getQueryData(queryKey)).toEqual({ items: [{ productId: 1, quantity: 2 }] })
})
`

// 생성된 뮤테이션 훅이 재생성 계층의 fetch 함수와 MSW 핸들러로 실제로 동작하는지 보는 Starter 테스트
const PRODUCTS_MUTATIONS_TEST = `import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  getCreateProductMockHandler,
  getListProductsMockHandler,
  getUpdateProductMockHandler,
} from '@/shared/api/generated/products/products.msw'
import { server } from '@/shared/mocks/node'
import { listProductsQueryOptions, useCreateProductMutation, useUpdateProductMutation } from './products.queries'

// static-export Starter는 브라우저가 백엔드를 직접 부르므로 그 요청을 MSW가 받게 한다. server Starter는 이 값을 읽지 않는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function wrapperWith(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

test('뮤테이션이 성공하면 Query Domain의 쿼리를 무효화해, 화면이 보고 있는 목록을 다시 가져온다', async () => {
  const products = [{ id: 1, name: '기본 티셔츠', price: 19000 }]
  const created = { id: 3, name: '울 니트', price: 59000 }
  server.use(
    getListProductsMockHandler(() => products),
    getCreateProductMockHandler(() => {
      products.push(created)
      return created
    }),
  )
  const { result } = renderHook(
    () => ({ products: useQuery(listProductsQueryOptions()), createProduct: useCreateProductMutation() }),
    { wrapper: wrapperWith(new QueryClient()) },
  )
  await waitFor(() => {
    expect(result.current.products.data).toEqual([{ id: 1, name: '기본 티셔츠', price: 19000 }])
  })

  await act(() => result.current.createProduct.mutateAsync({ name: '울 니트', price: 59000 }))

  await waitFor(() => {
    expect(result.current.products.data).toEqual([
      { id: 1, name: '기본 티셔츠', price: 19000 },
      { id: 3, name: '울 니트', price: 59000 },
    ])
  })
})

test('낙관적 업데이트는 훅에 넘긴 인자의 쿼리를 응답 전에 고친다', async () => {
  const response = Promise.withResolvers<undefined>()
  server.use(
    getUpdateProductMockHandler(async () => {
      await response.promise
      return { id: 1, name: '기본 티셔츠(흰색)', price: 21000 }
    }),
  )
  const queryClient = new QueryClient()
  const params = { q: '티셔츠' }
  const { queryKey } = listProductsQueryOptions(params)
  queryClient.setQueryData(queryKey, [{ id: 1, name: '기본 티셔츠', price: 19000 }])
  const { result } = renderHook(() => useUpdateProductMutation(params), { wrapper: wrapperWith(queryClient) })

  act(() => {
    result.current.mutate({ productId: 1, newProduct: { name: '기본 티셔츠(흰색)', price: 21000 } })
  })

  await waitFor(() => {
    expect(queryClient.getQueryData(queryKey)).toEqual([{ id: 1, name: '기본 티셔츠(흰색)', price: 21000 }])
  })
  expect(result.current.isPending).toBe(true)
  response.resolve(undefined)
  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true)
  })
})
`

/**
 * ALL_SCHEMATICS를 모두 실행한 Starter가 생성 직후 그대로 Starter 자신의 타입 검사, lint, 포맷 검사를 통과하고,
 * 생성한 훅을 쓰는 Starter 테스트가 (--optimistic의 뼈대를 채운 뒤) 통과하는지 본다.
 */
function expectGeneratedMutationsToPassStarterChecks(starter: Starter): void {
  for (const args of ALL_SCHEMATICS) {
    const result = dcgen(starter, ['g', ...args])
    expect(result.status, result.output).toBe(0)
  }
  starter.writeFile(`${QUERIES_DIR}/products/products.harness.test.tsx`, PRODUCTS_MUTATIONS_TEST)
  starter.writeFile(`${QUERIES_DIR}/cart/cart.harness.test.tsx`, CART_MUTATIONS_TEST)

  for (const script of ['typecheck', 'lint', 'format:check']) starter.expectNpmSuccess(['run', script])

  // 뼈대의 타입(고칠 쿼리의 데이터, mutate에 넘긴 값)만으로 낙관적 업데이트를 채울 수 있고, 채우면 Starter 테스트가 통과한다.
  for (const [file, update] of Object.entries(OPTIMISTIC_UPDATES)) {
    const path = `${QUERIES_DIR}/${file}`
    const source = readFileSync(join(starter.dir, path), 'utf8')
    expect(source).toContain(OPTIMISTIC_SKELETON)
    starter.writeFile(path, source.replace(OPTIMISTIC_SKELETON, update))
  }
  starter.expectNpmSuccess(['run', 'typecheck'])
  starter.expectNpmSuccess(['test'])
}

describe('server Starter', () => {
  const starter = useStarter({ prefix: 'dcgen-g-mutation-', install: true })
  let pristineQueries: string
  const queriesTree = () => readTree(join(starter.dir, QUERIES_DIR))

  beforeAll(() => {
    addOperations(starter, HARNESS_OPERATIONS)
    pristineQueries = join(starter.workdir, 'pristine-queries')
    cpSync(join(starter.dir, QUERIES_DIR), pristineQueries, { recursive: true })
  })

  // 테스트마다 src/queries를 생성 직후(Base의 샘플 Query Domain만 있는 상태)로 되돌린다.
  beforeEach(() => {
    rmSync(join(starter.dir, QUERIES_DIR), { recursive: true, force: true })
    cpSync(pristineQueries, join(starter.dir, QUERIES_DIR), { recursive: true })
  })

  test('npm run g -- mutation은 Query Domain 모듈이 있으면 손으로 쓴 코드를 그대로 두고 쿼리 모듈에 뮤테이션 훅을 끼워 넣는다', async () => {
    const keysBefore = readTree(join(starter.dir, QUERIES_DIR))['products/products.keys.ts']

    const result = starter.npm(['run', 'g', '--', 'mutation', 'createProduct'])
    expect(result.status, result.failureMessage).toBe(0)
    for (const args of [['updateProduct'], ['deleteProduct']]) {
      const next = dcgen(starter, ['g', 'mutation', ...args])
      expect(next.status, next.output).toBe(0)
    }

    expect(queriesTree()['products/products.keys.ts']).toBe(keysBefore)
    await expectModulesToMatchSnapshots(starter, ['products.queries.ts'])
  })

  test('dcgen g mutation은 Query Domain 모듈이 없으면 operation의 tag로 무효화할 쿼리 키(cartKeys.all)를 담은 쿼리 키 모듈과 쿼리 모듈을 만든다', async () => {
    const result = dcgen(starter, ['g', 'mutation', 'clearCart'])

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('만듦  src/queries/cart/cart.keys.ts')
    expect(result.output).toContain('만듦  src/queries/cart/cart.queries.ts')
    expect(Object.keys(queriesTree()).sort()).toEqual([
      'cart/cart.keys.ts',
      'cart/cart.queries.ts',
      'products/products.keys.ts',
      'products/products.queries.ts',
    ])
    await expectModulesToMatchSnapshots(starter, ['cart.keys.ts', 'cart.queries.ts'])
  })

  test('--optimistic <queryOperationId>는 그 쿼리의 캐시를 응답 전에 고치고, 실패하면 되돌리고, 끝나면 무효화하는 뼈대를 만든다', async () => {
    // getCart는 인자가 없는 쿼리, listProducts는 인자(params)를 받는 쿼리다.
    for (const args of [
      ['query', 'getCart'],
      ['mutation', 'addCartItem', '--optimistic', 'getCart'],
      ['mutation', 'updateProduct', '--optimistic', 'listProducts'],
    ]) {
      const result = dcgen(starter, ['g', ...args])
      expect(result.status, result.output).toBe(0)
    }

    await expectModulesToMatchSnapshots(starter, ['cart.queries.ts', 'products.queries.ts'], 'optimistic')
  })

  test('같은 이름의 뮤테이션 훅이나 낙관적 업데이트 함수가 이미 있으면 덮어쓰지 않고 무엇이 겹치는지 알린 뒤 실패한다', () => {
    // 개발자가 손으로 쓴 updateProduct 뮤테이션 훅과 낙관적 업데이트 함수
    const queries = `${QUERIES_DIR}/products/products.queries.ts`
    starter.writeFile(
      queries,
      `${readFileSync(join(starter.dir, queries), 'utf8')}
export function useUpdateProductMutation() {}

const applyUpdateProduct = () => undefined
`,
    )
    const before = queriesTree()

    const result = dcgen(starter, ['g', 'mutation', 'updateProduct', '--optimistic', 'listProducts'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('src/queries/products/products.queries.ts: useUpdateProductMutation')
    expect(result.output).toContain('src/queries/products/products.queries.ts: applyUpdateProduct')
    expect(queriesTree()).toEqual(before)
  })

  test.each([
    {
      problem: '명세에 없는 operationId',
      args: ['createProductz'],
      reason: "operationId가 'createProductz'인 operation이 없습니다",
    },
    { problem: 'GET operation', args: ['listProducts'], reason: 'POST, PUT, PATCH, DELETE operation으로만 만듭니다' },
    {
      problem: '--optimistic에 명세에 없는 operationId',
      args: ['createProduct', '--optimistic', 'listProductz'],
      reason: "operationId가 'listProductz'인 operation이 없습니다",
    },
    {
      problem: '--optimistic에 GET이 아닌 operation',
      args: ['createProduct', '--optimistic', 'deleteProduct'],
      reason: '--optimistic에는 응답 전에 고칠 쿼리의 GET operation을 지정합니다',
    },
    {
      problem: '--optimistic에 다른 Query Domain의 쿼리',
      args: ['createProduct', '--optimistic', 'getCart'],
      reason: '--optimistic에는 같은 Query Domain(products)의 쿼리를 지정합니다',
    },
    {
      problem: '--optimistic에 아직 만들지 않은 쿼리',
      args: ['addCartItem', '--optimistic', 'getCart'],
      reason: 'npm run g -- query getCart로 만드세요',
    },
  ])('$problem: 이유를 알리고 아무 파일도 바꾸지 않은 채 실패한다', ({ args, reason }) => {
    const before = queriesTree()

    const result = dcgen(starter, ['g', 'mutation', ...args])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain(reason)
    expect(queriesTree()).toEqual(before)
  })

  test('mutation Schematic이 만든 코드로 Starter의 타입 검사, lint, 포맷 검사, 테스트가 모두 통과한다', () => {
    expectGeneratedMutationsToPassStarterChecks(starter)
  })
})

// 다른 Rendering Mode와 Recipe를 덧입힌 Starter에서도 생성한 코드가 Starter의 검사를 통과한다. 설치가 오래 걸리므로
// static-export Starter 하나에 dark-mode Recipe를 함께 넣는다.
describe('dark-mode Recipe를 넣은 static-export Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-g-mutation-static-',
    renderingMode: 'static-export',
    recipes: ['dark-mode'],
    install: true,
  })

  beforeAll(() => {
    addOperations(starter, HARNESS_OPERATIONS)
  })

  test('mutation Schematic이 만든 코드로 Starter의 타입 검사, lint, 포맷 검사, 테스트가 모두 통과한다', () => {
    expectGeneratedMutationsToPassStarterChecks(starter)
  })
})
