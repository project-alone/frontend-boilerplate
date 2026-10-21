import type { Metadata } from 'next'
import { CheckoutForm } from '@/features/shop-checkout/checkout-form'

export const metadata: Metadata = {
  title: '주문서',
  robots: { index: false },
}

// 커머스 Archetype의 주문서. multi-step-form Recipe의 부품으로 배송 정보 → 결제 수단 → 주문 확인을 단계마다 검증해 입력받고,
// 주문하면 가짜 결제 단계(/shop/orders/<주문 번호>/payment)로 간다. 페이지 뼈대는 빌드할 때 미리 만들고, 장바구니와 입력하던
// 값은 브라우저가 들고 있다가 주문할 때 한 번 보낸다.
export default function CheckoutPage() {
  return (
    <main className="flex flex-col gap-6 p-4">
      <h1 className="text-lg font-semibold">주문서</h1>
      <CheckoutForm />
    </main>
  )
}
