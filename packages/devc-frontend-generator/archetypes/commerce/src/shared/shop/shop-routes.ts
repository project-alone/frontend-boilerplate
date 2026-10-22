// 커머스 Archetype의 라우트(src/app/shop). 화면 사이의 링크와 이동은 이 경로를 쓴다.

/** 상품 목록(ISR) */
export const SHOP_PATH = '/shop'

/** 장바구니 */
export const CART_PATH = '/shop/cart'

/** 주문서(다단계 폼) */
export const CHECKOUT_PATH = '/shop/checkout'

/** 주문의 결제와 주문 완료 화면이 모이는 경로 */
const ORDERS_PATH = '/shop/orders'

/** 상품 상세(ISR) */
export function productPath(productId: number): string {
  return `${SHOP_PATH}/products/${String(productId)}`
}

/** 주문 완료(주문 내역) */
export function orderPath(orderId: string): string {
  return `${ORDERS_PATH}/${encodeURIComponent(orderId)}`
}

/** 가짜 결제 단계(테스트 결제창) */
export function orderPaymentPath(orderId: string): string {
  return `${orderPath(orderId)}/payment`
}

/**
 * sitemap 규칙(확장 지점 sitemap). 장바구니, 주문서, 주문은 사람마다 다른 화면이라 검색 엔진에 알리지 않는다(그 페이지의
 * metadata는 noindex). 상품 목록은 sitemap에 들어가고, 동적 세그먼트인 상품 상세는 sitemap이 저절로 넣지 않는다.
 * sitemap을 만드는 Recipe(seo)가 없는 Starter에서는 쓰이지 않는다.
 */
export const shopSitemapRules = {
  exclude: [CART_PATH, CHECKOUT_PATH, ORDERS_PATH],
}
