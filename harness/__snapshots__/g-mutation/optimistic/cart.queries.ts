import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCart, addCartItem } from '@/shared/api/generated'
import { cartKeys } from './cart.keys'
import type { CartItem, Cart } from '@/shared/api/generated/model'

// cart Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function getCartQueryOptions() {
  return queryOptions({
    queryKey: cartKeys.getCart(),
    queryFn: ({ signal }) => getCart({ signal }),
  })
}

// addCartItem의 응답이 오기 전에 getCart 쿼리에 보일 값(낙관적 업데이트). 보낸 값으로 응답 뒤의 값을 짐작해 돌려주도록 고친다.
// 지금은 캐시를 그대로 두므로, 응답 뒤에 쿼리를 다시 가져와야 화면이 바뀐다.
const applyAddCartItem: (current: Cart, cartItem: CartItem) => Cart = (current) => current

export function useAddCartItemMutation() {
  const queryClient = useQueryClient()
  // 응답 전에 고칠 getCart 쿼리.
  const { queryKey } = getCartQueryOptions()
  return useMutation({
    mutationFn: (cartItem: CartItem) => addCartItem(cartItem),
    onMutate: async (cartItem) => {
      // 진행 중인 getCart 요청의 응답이 고친 값을 덮어쓰지 않도록 취소하고, 되돌릴 값을 남긴다.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (current) =>
        current === undefined ? undefined : applyAddCartItem(current, cartItem),
      )
      return { previous }
    },
    onError: (_error, _cartItem, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    // 성공하든 실패하든 cart Query Domain의 쿼리를 모두 무효화해 서버의 값으로 맞춘다.
    onSettled: () => queryClient.invalidateQueries({ queryKey: cartKeys.all }),
  })
}
