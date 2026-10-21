// 커머스 Archetype: 원 단위 금액을 원화(KRW) 통화 표기로 보여 준다(예: ₩19,000). locale과 통화를 정해 두어 서버와 브라우저가
// 같은 문자열을 만들므로 hydration이 어긋나지 않는다.
const KRW = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' })

/** 원 단위 금액(명세의 price, totalPrice)을 원화로 적는다. */
export function formatPrice(amount: number): string {
  return KRW.format(amount)
}
