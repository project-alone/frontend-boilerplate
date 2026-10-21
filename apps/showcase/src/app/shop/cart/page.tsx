// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/app/shop/cart/page.tsx

import type { Metadata } from 'next'
import { CartView } from '@/features/shop-cart/cart-view'

export const metadata: Metadata = {
  title: '장바구니',
  robots: { index: false },
}

// 커머스 Archetype의 장바구니. 장바구니는 이 브라우저에 둔 id로 찾으므로 페이지 뼈대는 빌드할 때 미리 만들고(SSG), 담긴 상품은
// 브라우저가 BFF 프록시로 가져와 고친다(낙관적 업데이트).
export default function CartPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">장바구니</h1>
      <CartView />
    </main>
  )
}
