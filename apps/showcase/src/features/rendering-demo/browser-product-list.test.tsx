// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/route-rendering/src/features/rendering-demo/browser-product-list.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { expect, onTestFinished, test, vi } from 'vitest'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import { getListProductsMockHandler } from '@/shared/api/generated/products/products.msw'
import { server } from '@/shared/mocks/node'
import { BrowserProductList } from './browser-product-list'

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

test('불러오는 중임을 알린 뒤, 브라우저가 BFF 프록시로 받은 샘플 명세의 상품 목록을 보여 준다', async () => {
  // 테스트는 브라우저의 요청도 목 백엔드로 보내므로(vitest.setup.ts) 기본값인 BFF 프록시로 보내게 비운다. 테스트에는 프록시를
  // 받을 Next.js 서버가 없으므로, 프록시처럼 목 백엔드(MSW)의 응답을 그대로 돌려준다.
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')
  onTestFinished(() => {
    vi.unstubAllEnvs()
  })
  server.use(http.get('*/api/proxy/products', () => fetch(`${MOCK_API_BASE_URL}/products`)))
  const requested: string[] = []
  server.events.on('request:start', ({ request }) => requested.push(new URL(request.url).pathname))
  onTestFinished(() => {
    server.events.removeAllListeners()
  })

  renderWithQueryClient(<BrowserProductList />)

  expect(screen.getByRole('status')).toHaveTextContent('상품을 불러오는 중입니다.')
  expect(await screen.findByText(/기본 티셔츠/)).toBeInTheDocument()
  expect(screen.getByText(/데님 재킷/)).toBeInTheDocument()
  expect(requested[0]).toBe('/api/proxy/products')
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
