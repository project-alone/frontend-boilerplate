import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCart, createCart, addCartItem, updateCartItem, removeCartItem } from '@/shared/api/generated'
import { cartKeys } from './cart.keys'
import type { NewCartItem, Cart, CartItemUpdate } from '@/shared/api/generated/model'

// cart Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function getCartQueryOptions(cartId: string) {
  return queryOptions({
    queryKey: cartKeys.getCart(cartId),
    queryFn: ({ signal }) => getCart(cartId, { signal }),
  })
}

export function useCreateCartMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newCartItem: NewCartItem) => createCart(newCartItem),
    // 성공하면 cart Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...cartKeys.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cartKeys.all }),
  })
}

// addCartItem의 응답이 오기 전에 getCart 쿼리에 보일 값(낙관적 업데이트). 보낸 값으로 응답 뒤의 값을 짐작해 돌려주도록 고친다.
// 커머스 Archetype: 이미 담긴 상품이면 그 수량과 합계를 늘린다. 처음 담는 상품은 이름과 가격을 응답으로 받아야 알 수 있으므로
// 담긴 수량의 합(totalQuantity)만 먼저 늘리고, 그 줄과 금액은 응답 뒤에 다시 가져온 장바구니로 채운다.
const applyAddCartItem: (current: Cart, variables: { cartId: string; newCartItem: NewCartItem }) => Cart = (
  current,
  { newCartItem: { productId, quantity } },
) => {
  if (!current.items.some((item) => item.productId === productId)) {
    return { ...current, totalQuantity: current.totalQuantity + quantity }
  }
  const items = current.items.map((item) =>
    item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item,
  )
  return {
    ...current,
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalPrice: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  }
}

export function useAddCartItemMutation(cartId: string) {
  const queryClient = useQueryClient()
  // 응답 전에 고칠 getCart 쿼리. 화면이 보고 있는 쿼리와 같은 인자를 훅에 넘긴다.
  const { queryKey } = getCartQueryOptions(cartId)
  return useMutation({
    mutationFn: ({ cartId, newCartItem }: { cartId: string; newCartItem: NewCartItem }) =>
      addCartItem(cartId, newCartItem),
    onMutate: async (variables) => {
      // 진행 중인 getCart 요청의 응답이 고친 값을 덮어쓰지 않도록 취소하고, 되돌릴 값을 남긴다.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (current) =>
        current === undefined ? undefined : applyAddCartItem(current, variables),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    // 성공하든 실패하든 cart Query Domain의 쿼리를 모두 무효화해 서버의 값으로 맞춘다.
    onSettled: () => queryClient.invalidateQueries({ queryKey: cartKeys.all }),
  })
}

// updateCartItem의 응답이 오기 전에 getCart 쿼리에 보일 값(낙관적 업데이트). 보낸 값으로 응답 뒤의 값을 짐작해 돌려주도록 고친다.
// 커머스 Archetype: 그 상품의 수량을 보낸 값으로 바꾸고 합계를 다시 계산한다(명세: 보낸 수량으로 바꾼다).
const applyUpdateCartItem: (
  current: Cart,
  variables: { cartId: string; productId: number; cartItemUpdate: CartItemUpdate },
) => Cart = (current, { productId, cartItemUpdate: { quantity } }) => {
  const items = current.items.map((item) => (item.productId === productId ? { ...item, quantity } : item))
  return {
    ...current,
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalPrice: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  }
}

export function useUpdateCartItemMutation(cartId: string) {
  const queryClient = useQueryClient()
  // 응답 전에 고칠 getCart 쿼리. 화면이 보고 있는 쿼리와 같은 인자를 훅에 넘긴다.
  const { queryKey } = getCartQueryOptions(cartId)
  return useMutation({
    mutationFn: ({
      cartId,
      productId,
      cartItemUpdate,
    }: {
      cartId: string
      productId: number
      cartItemUpdate: CartItemUpdate
    }) => updateCartItem(cartId, productId, cartItemUpdate),
    onMutate: async (variables) => {
      // 진행 중인 getCart 요청의 응답이 고친 값을 덮어쓰지 않도록 취소하고, 되돌릴 값을 남긴다.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (current) =>
        current === undefined ? undefined : applyUpdateCartItem(current, variables),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    // 성공하든 실패하든 cart Query Domain의 쿼리를 모두 무효화해 서버의 값으로 맞춘다.
    onSettled: () => queryClient.invalidateQueries({ queryKey: cartKeys.all }),
  })
}

// removeCartItem의 응답이 오기 전에 getCart 쿼리에 보일 값(낙관적 업데이트). 보낸 값으로 응답 뒤의 값을 짐작해 돌려주도록 고친다.
// 커머스 Archetype: 그 상품을 빼고 합계를 다시 계산한다.
const applyRemoveCartItem: (current: Cart, variables: { cartId: string; productId: number }) => Cart = (
  current,
  { productId },
) => {
  const items = current.items.filter((item) => item.productId !== productId)
  return {
    ...current,
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalPrice: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  }
}

export function useRemoveCartItemMutation(cartId: string) {
  const queryClient = useQueryClient()
  // 응답 전에 고칠 getCart 쿼리. 화면이 보고 있는 쿼리와 같은 인자를 훅에 넘긴다.
  const { queryKey } = getCartQueryOptions(cartId)
  return useMutation({
    mutationFn: ({ cartId, productId }: { cartId: string; productId: number }) => removeCartItem(cartId, productId),
    onMutate: async (variables) => {
      // 진행 중인 getCart 요청의 응답이 고친 값을 덮어쓰지 않도록 취소하고, 되돌릴 값을 남긴다.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (current) =>
        current === undefined ? undefined : applyRemoveCartItem(current, variables),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    // 성공하든 실패하든 cart Query Domain의 쿼리를 모두 무효화해 서버의 값으로 맞춘다.
    onSettled: () => queryClient.invalidateQueries({ queryKey: cartKeys.all }),
  })
}
