// sales-stats Query Domain(OpenAPI tag `Sales Stats`)의 쿼리 키. 위 단계의 키로 아래 단계를 한꺼번에 무효화할 수 있게
// ['sales-stats'] → ['sales-stats', <operationId>] → ['sales-stats', <operationId>, ...인자]처럼 계층으로 만든다.
export const salesStatsKeys = {
  all: ['sales-stats'] as const,
  getSalesStats: () => [...salesStatsKeys.all, 'getSalesStats'] as const,
}
