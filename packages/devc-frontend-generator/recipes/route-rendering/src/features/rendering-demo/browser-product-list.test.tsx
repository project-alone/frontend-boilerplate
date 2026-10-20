import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { expect, onTestFinished, test } from 'vitest'
import { getListProductsMockHandler } from '@/shared/api/generated/products/products.msw'
import { server } from '@/shared/mocks/node'
import { BrowserProductList } from './browser-product-list'

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

test('불러오는 중임을 알린 뒤, 브라우저가 BFF 프록시로 받은 샘플 명세의 상품 목록을 보여 준다', async () => {
  const requested: string[] = []
  server.events.on('request:start', ({ request }) => requested.push(new URL(request.url).pathname))
  onTestFinished(() => {
    server.events.removeAllListeners()
  })

  renderWithQueryClient(<BrowserProductList />)

  expect(screen.getByRole('status')).toHaveTextContent('상품을 불러오는 중입니다.')
  expect(await screen.findByText(/기본 티셔츠/)).toBeInTheDocument()
  expect(screen.getByText(/데님 재킷/)).toBeInTheDocument()
  expect(requested).toEqual(['/api/proxy/products'])
})

test('상품이 없으면 안내 문구를 보여 준다', async () => {
  // 생성된 핸들러에 응답을 넘겨 이 테스트에서만 바꾼다.
  server.use(getListProductsMockHandler([]))

  renderWithQueryClient(<BrowserProductList />)

  expect(await screen.findByText('등록된 상품이 없습니다.')).toBeInTheDocument()
})

test('백엔드가 실패하면 불러오지 못했다고 알린다', async () => {
  server.use(http.get('*/products', () => HttpResponse.json({ message: '점검 중' }, { status: 503 })))

  renderWithQueryClient(<BrowserProductList />)

  expect(await screen.findByRole('alert')).toHaveTextContent('상품을 불러오지 못했습니다.')
})
