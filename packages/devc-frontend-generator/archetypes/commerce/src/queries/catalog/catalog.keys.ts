// catalog Query Domain(OpenAPI tag `catalog`)의 쿼리 키. 위 단계의 키로 아래 단계를 한꺼번에 무효화할 수 있게
// ['catalog'] → ['catalog', <operationId>] → ['catalog', <operationId>, ...인자]처럼 계층으로 만든다.
export const catalogKeys = {
  all: ['catalog'] as const,
  listCatalogProducts: () => [...catalogKeys.all, 'listCatalogProducts'] as const,
  getCatalogProduct: (productId: number) => [...catalogKeys.all, 'getCatalogProduct', productId] as const,
}
