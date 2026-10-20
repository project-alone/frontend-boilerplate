// stats Query Domain(OpenAPI tag `stats`)의 쿼리 키. 위 단계의 키로 아래 단계를 한꺼번에 무효화할 수 있게
// ['stats'] → ['stats', <operationId>] → ['stats', <operationId>, ...인자]처럼 계층으로 만든다.
export const statsKeys = {
  all: ['stats'] as const,
  listDailyVisits: () => [...statsKeys.all, 'listDailyVisits'] as const,
  listChannelSales: () => [...statsKeys.all, 'listChannelSales'] as const,
}
