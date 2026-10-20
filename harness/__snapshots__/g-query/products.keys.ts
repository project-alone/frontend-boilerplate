import type { ListProductsParams } from '@/shared/api/generated/model'

// products Query Domain(OpenAPI tag `products`)의 쿼리 키. 위 단계의 키로 아래 단계를 한꺼번에 무효화할 수 있게
// ['products'] → ['products', <operationId>] → ['products', <operationId>, ...인자]처럼 계층으로 만든다.
export const productsKeys = {
  all: ['products'] as const,
  listProducts: (params: ListProductsParams) => [...productsKeys.all, 'listProducts', params] as const,
  getProduct: (productId: number) => [...productsKeys.all, 'getProduct', productId] as const,
}
