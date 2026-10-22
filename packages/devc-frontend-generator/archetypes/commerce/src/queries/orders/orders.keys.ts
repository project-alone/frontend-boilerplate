// orders Query Domain(OpenAPI tag `orders`)의 쿼리 키. 위 단계의 키로 아래 단계를 한꺼번에 무효화할 수 있게
// ['orders'] → ['orders', <operationId>] → ['orders', <operationId>, ...인자]처럼 계층으로 만든다.
export const ordersKeys = {
  all: ['orders'] as const,
  getOrder: (orderId: string) => [...ordersKeys.all, 'getOrder', orderId] as const,
}
