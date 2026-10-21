// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/queries/cart/cart.keys.ts

// cart Query Domain(OpenAPI tag `cart`)의 쿼리 키. 위 단계의 키로 아래 단계를 한꺼번에 무효화할 수 있게
// ['cart'] → ['cart', <operationId>] → ['cart', <operationId>, ...인자]처럼 계층으로 만든다.
export const cartKeys = {
  all: ['cart'] as const,
  getCart: (cartId: string) => [...cartKeys.all, 'getCart', cartId] as const,
}
