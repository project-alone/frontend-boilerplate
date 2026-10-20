import { queryOptions, infiniteQueryOptions } from '@tanstack/react-query'
import { listOrders, getOrder } from '@/shared/api/generated'
import type { ListOrdersParams } from '@/shared/api/generated/model'
import { ordersKeys } from './orders.keys'

// orders Query Domain의 queryOptions. 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 같은 옵션을 쓴다.

export function listOrdersQueryOptions(params: ListOrdersParams = {}) {
  return queryOptions({
    queryKey: ordersKeys.listOrders(params),
    queryFn: ({ signal }) => listOrders(params, { signal }),
  })
}

export function listOrdersInfiniteQueryOptions(params: Omit<ListOrdersParams, 'page'> = {}) {
  return infiniteQueryOptions({
    queryKey: ordersKeys.listOrdersInfinite(params),
    queryFn: ({ pageParam, signal }) => listOrders({ ...params, page: pageParam }, { signal }),
    initialPageParam: 1,
    // 빈 페이지를 받으면 다음 페이지가 없다고 본다. 백엔드가 다음 페이지 정보를 함께 주면 그 값을 쓰도록 고친다.
    getNextPageParam: (lastPage, _allPages, lastPageParam) => (lastPage.length === 0 ? undefined : lastPageParam + 1),
  })
}

export function getOrderQueryOptions(orderId: number) {
  return queryOptions({
    queryKey: ordersKeys.getOrder(orderId),
    queryFn: ({ signal }) => getOrder(orderId, { signal }),
  })
}
