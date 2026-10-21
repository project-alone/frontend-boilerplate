import { http, HttpResponse } from 'msw'
import * as generatedMocks from '@/shared/api/generated/index.msw'
import type { Product } from '@/shared/api/generated/model'
import { getCreateProductMockHandler, getListProductsMockHandler } from '@/shared/api/generated/products/products.msw'

// 하네스(harness/g-page.test.ts)가 Starter의 핸들러 목록(Generator가 조립한 src/shared/mocks/handlers.ts)을 바꿔 둔
// 파일이다. 등록한 상품(createProduct)이 목록(listProducts)과 상세(/products/:productId)에 나오도록 상품을 메모리에 둔다.
// server Starter에서는 Next.js 서버가, static-export Starter에서는 페이지를 연 브라우저가 이 목록을 갖는다. 나머지 요청은
// Base처럼 생성된 핸들러가 명세의 example로 받는다.
const products: Product[] = [
  { id: 1, name: '기본 티셔츠', price: 19000 },
  { id: 2, name: '데님 재킷', price: 89000 },
]

export const handlers = [
  getListProductsMockHandler(() => products),
  getCreateProductMockHandler(async ({ request }) => {
    const product: Product = { ...((await request.json()) as Omit<Product, 'id'>), id: products.length + 1 }
    products.push(product)
    return product
  }),
  // 없는 상품은 404로 답해 페이지의 오류 상태(error.tsx)를 볼 수 있게 한다.
  http.get('*/products/:productId', ({ params }) => {
    const product = products.find(({ id }) => String(id) === params['productId'])
    return product === undefined
      ? HttpResponse.json({ message: '없는 상품입니다.' }, { status: 404 })
      : HttpResponse.json(product)
  }),
  ...Object.values(generatedMocks).flatMap((getMockHandlers) => getMockHandlers()),
]
