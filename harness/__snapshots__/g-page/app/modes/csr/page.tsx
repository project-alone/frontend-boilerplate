import type { Metadata } from 'next'
import { ListProductsView } from '@/features/catalog/list-products-view'

export const metadata: Metadata = {
  title: '상품 목록',
}

// CSR: 페이지 뼈대는 빌드할 때 미리 렌더링하고(SSG), 데이터는 브라우저가 클라이언트 컴포넌트에서 가져온다.
// 화면은 Feature의 컴포넌트를 조합해 그린다(ADR-0005).
export default function ModesCsrPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">상품 목록</h1>
      <ListProductsView />
    </main>
  )
}
