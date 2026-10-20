import { environmentManager, QueryClient } from '@tanstack/react-query'

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 서버가 prefetch해 hydration으로 넘긴 데이터를 브라우저가 받자마자 다시 요청하지 않도록 0보다 크게 둔다.
        staleTime: 60 * 1000,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

/**
 * 서버에서는 부를 때마다 새 QueryClient를 만들어 요청 사이에 캐시가 섞이지 않게 하고,
 * 브라우저에서는 QueryClient 하나를 계속 쓴다. 서버 컴포넌트의 prefetch와 QueryProvider가 함께 쓴다.
 */
export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) return makeQueryClient()
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}
