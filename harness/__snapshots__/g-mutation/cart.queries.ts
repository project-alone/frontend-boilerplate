import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearCart } from '@/shared/api/generated'
import { cartKeys } from './cart.keys'

// cart Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function useClearCartMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => clearCart(),
    // 성공하면 cart Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...cartKeys.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cartKeys.all }),
  })
}
