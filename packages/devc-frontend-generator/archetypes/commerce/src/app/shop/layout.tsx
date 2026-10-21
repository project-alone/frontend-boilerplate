import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ShopNav } from '@/features/shop-nav/shop-nav'

export const metadata: Metadata = {
  title: { template: '%s | 쇼핑', default: '쇼핑' },
}

// 커머스 Archetype: /shop 아래의 모든 화면 위에 쇼핑몰 안의 이동(상품, 장바구니와 담긴 수량)을 둔다. 상품 목록과 상세는 ISR로
// 미리 렌더링하고, 장바구니·주문서·결제는 브라우저에 둔 장바구니 id로 브라우저가 가져온다. 이 레이아웃은 요청마다 달라지는 값을
// 읽지 않으므로 아래 페이지의 Rendering Mode를 바꾸지 않는다.
export default function ShopLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex flex-col">
      <ShopNav />
      {children}
    </div>
  )
}
