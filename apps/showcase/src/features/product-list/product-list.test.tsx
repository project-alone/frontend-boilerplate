// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/features/product-list/product-list.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { Suspense, type ReactNode } from 'react'
import { expect, test } from 'vitest'
import { getListProductsMockHandler } from '@/shared/api/generated/products/products.msw'
import { server } from '@/shared/mocks/node'
import { ProductList } from './product-list'

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>불러오는 중</p>}>{ui}</Suspense>
    </QueryClientProvider>,
  )
}

test('MSW가 돌려준 샘플 명세의 상품 목록을 보여 준다', async () => {
  renderWithQueryClient(<ProductList />)

  expect(await screen.findByText(/기본 티셔츠/)).toBeInTheDocument()
  expect(screen.getByText(/데님 재킷/)).toBeInTheDocument()
})

test('상품이 없으면 안내 문구를 보여 준다', async () => {
  // 생성된 핸들러에 응답을 넘겨 이 테스트에서만 바꾼다.
  server.use(getListProductsMockHandler([]))

  renderWithQueryClient(<ProductList />)

  expect(await screen.findByText('등록된 상품이 없습니다.')).toBeInTheDocument()
})
