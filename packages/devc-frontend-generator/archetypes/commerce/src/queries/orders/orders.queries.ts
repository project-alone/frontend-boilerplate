import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrder, placeOrder, confirmOrderPayment } from '@/shared/api/generated'
import { ordersKeys } from './orders.keys'
import type { NewOrder, OrderPayment } from '@/shared/api/generated/model'

// orders Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function getOrderQueryOptions(orderId: string) {
  return queryOptions({
    queryKey: ordersKeys.getOrder(orderId),
    queryFn: ({ signal }) => getOrder(orderId, { signal }),
  })
}

export function usePlaceOrderMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newOrder: NewOrder) => placeOrder(newOrder),
    // 성공하면 orders Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...ordersKeys.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ordersKeys.all }),
  })
}

export function useConfirmOrderPaymentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, orderPayment }: { orderId: string; orderPayment: OrderPayment }) =>
      confirmOrderPayment(orderId, orderPayment),
    // 성공하면 orders Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...ordersKeys.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ordersKeys.all }),
  })
}
