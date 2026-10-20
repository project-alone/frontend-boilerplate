import type { ListOrdersParams } from '@/shared/api/generated/model'

// orders Query Domain(OpenAPI tag `orders`)의 쿼리 키. 위 단계의 키로 아래 단계를 한꺼번에 무효화할 수 있게
// ['orders'] → ['orders', <operationId>] → ['orders', <operationId>, ...인자]처럼 계층으로 만든다.
export const ordersKeys = {
  all: ['orders'] as const,
  listOrders: (params: ListOrdersParams) => [...ordersKeys.all, 'listOrders', params] as const,
  listOrdersInfinite: (params: Omit<ListOrdersParams, 'page'>) =>
    [...ordersKeys.all, 'listOrders', 'infinite', params] as const,
  getOrder: (orderId: number) => [...ordersKeys.all, 'getOrder', orderId] as const,
}
