// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/features/shop-checkout/order-lines.tsx

import { formatPrice } from '@/shared/shop/price'

/** 주문할(주문한) 상품 한 줄. 장바구니의 CartItem과 주문의 OrderItem이 같은 모양이다. */
export interface OrderLine {
  productId: number
  name: string
  price: number
  quantity: number
}

/**
 * 주문서의 확인 단계, 결제창, 주문 완료 화면이 함께 쓰는 상품 표. 상품마다 가격, 수량, 금액을 보여 주고 마지막 줄에 결제할
 * 금액을 둔다.
 */
export function OrderLines({
  caption,
  lines,
  totalPrice,
}: Readonly<{ caption: string; lines: readonly OrderLine[]; totalPrice: number }>) {
  return (
    <table className="w-full text-sm">
      <caption className="text-left text-md font-semibold">{caption}</caption>
      <thead>
        <tr className="border-b border-border text-muted-foreground">
          <th scope="col" className="py-2 text-left font-medium">
            상품
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            가격
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            수량
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            금액
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.productId} className="border-b border-border">
            <th scope="row" className="py-2 text-left font-normal">
              {line.name}
            </th>
            <td className="py-2 text-right">{formatPrice(line.price)}</td>
            <td className="py-2 text-right">{line.quantity}개</td>
            <td className="py-2 text-right">{formatPrice(line.price * line.quantity)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" colSpan={3} className="py-2 text-left">
            결제 금액
          </th>
          <td className="py-2 text-right font-semibold">{formatPrice(totalPrice)}</td>
        </tr>
      </tfoot>
    </table>
  )
}
