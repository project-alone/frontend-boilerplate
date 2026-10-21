import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { expect, test } from 'vitest'
import { server } from '@/shared/mocks/node'
import { CatalogProductDetail } from './catalog-product-detail'
import { CatalogProductList } from './catalog-product-list'

// 상품은 커머스의 목 백엔드(src/shared/mocks/shop.ts)가 명세의 example로 돌려주고, 요청은 Vitest의 MSW가 받는다.

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

test('상품마다 상세로 가는 이름, 소개, 원화 가격, 재고 안내(품절, 얼마 남지 않은 수량)를 보여 준다', async () => {
  renderWithQueryClient(<CatalogProductList />)

  expect(screen.getByRole('status')).toHaveTextContent('상품을 불러오는 중입니다.')
  const items = within(await screen.findByRole('list', { name: '상품 목록' })).getAllByRole('listitem')
  expect(items).toHaveLength(6)
  const [tShirt, , , , muffler, mug] = items
  expect(tShirt).toHaveTextContent('매일 입기 좋은 기본 반팔 티셔츠')
  expect(tShirt).toHaveTextContent('₩19,000')
  // 재고가 넉넉하면 재고를 알리지 않는다.
  expect(tShirt).not.toHaveTextContent('남은 수량')
  expect(muffler).toHaveTextContent('품절')
  expect(mug).toHaveTextContent('남은 수량 2개')
  expect(screen.getByRole('link', { name: '오가닉 코튼 티셔츠' })).toHaveAttribute('href', '/shop/products/1')
})

test('상품 목록을 불러오지 못하면 알린다', async () => {
  server.use(http.get('*/catalog/products', () => HttpResponse.json({ message: '점검 중' }, { status: 503 })))

  renderWithQueryClient(<CatalogProductList />)

  expect(await screen.findByRole('alert')).toHaveTextContent('상품을 불러오지 못했습니다.')
})

test('상품 상세는 가격, 재고, 설명을 보여 준다', async () => {
  renderWithQueryClient(<CatalogProductDetail productId={6} />)

  expect(await screen.findByText('₩18,000')).toBeInTheDocument()
  expect(screen.getByText('남은 수량 2개')).toBeInTheDocument()
  expect(screen.getByText(/작가가 손으로 빚어 구운 머그입니다/)).toBeInTheDocument()
})
