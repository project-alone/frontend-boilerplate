import type { Metadata } from 'next'
import { ProductList } from '@/features/product-list/product-list'

export const metadata: Metadata = {
  title: '상품',
}

// API 계층 샘플(Rendering Mode static-export): 요청을 받는 서버가 없으므로 빌드할 때는 페이지 뼈대만 만들고,
// 상품 목록은 브라우저가 백엔드에서 직접 가져온다(src/features/product-list).
export default function ProductsPage() {
  return (
    <main>
      <h1>상품</h1>
      <ProductList />
    </main>
  )
}
