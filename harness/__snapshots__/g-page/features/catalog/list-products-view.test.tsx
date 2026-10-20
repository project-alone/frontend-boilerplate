import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getListProductsMockHandler, getListProductsResponseMock } from '@/shared/api/generated/products/products.msw'
import { server } from '@/shared/mocks/node'
import { ListProductsView } from './list-products-view'

// Rendering Mode static-export에서는 브라우저가 백엔드를 직접 부르므로 그 요청을 MSW가 받도록 켠다. server에서는 이 값을 읽지 않는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function renderView() {
  // 실패한 요청을 다시 보내지 않아 실패한 상태를 바로 본다.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ListProductsView />
    </QueryClientProvider>,
  )
}

test('불러오는 중임을 알린 뒤 응답의 항목을 목록으로 보여 준다', async () => {
  const response = getListProductsResponseMock()
  server.use(getListProductsMockHandler(response))

  renderView()

  expect(screen.getByRole('status')).toHaveTextContent('불러오는 중입니다.')
  expect(await screen.findAllByRole('listitem')).toHaveLength(response.length)
})

test('항목이 없으면 안내 문구를 보여 준다', async () => {
  server.use(getListProductsMockHandler([]))

  renderView()

  expect(await screen.findByText('항목이 없습니다.')).toBeInTheDocument()
})

test('백엔드가 실패하면 불러오지 못했다고 알린다', async () => {
  server.use(http.get('*/products', () => HttpResponse.json({ message: '점검 중' }, { status: 503 })))

  renderView()

  expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다.')
})
