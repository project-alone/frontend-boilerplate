// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/shared/shop/shop-labels.ts

import type { PaymentMethod } from '@/shared/api/generated/model'

/** 커머스 Archetype: 결제 수단(명세의 PaymentMethod)의 화면에 보일 이름 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: '신용·체크카드',
  transfer: '계좌이체',
  mobile: '휴대폰 결제',
}
