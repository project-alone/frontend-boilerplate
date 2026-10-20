import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { listProducts, updateProduct } from '@/shared/api/generated'
import type { ListProductsParams, NewProduct, Product } from '@/shared/api/generated/model'
import { productsKeys } from './products.keys'

// products Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function listProductsQueryOptions(params: ListProductsParams = {}) {
  return queryOptions({
    queryKey: productsKeys.listProducts(params),
    queryFn: ({ signal }) => listProducts(params, { signal }),
  })
}

// updateProduct의 응답이 오기 전에 listProducts 쿼리에 보일 값(낙관적 업데이트). 보낸 값으로 응답 뒤의 값을 짐작해 돌려주도록 고친다.
// 지금은 캐시를 그대로 두므로, 응답 뒤에 쿼리를 다시 가져와야 화면이 바뀐다.
const applyUpdateProduct: (
  current: Product[],
  variables: { productId: number; newProduct: NewProduct },
) => Product[] = (current) => current

export function useUpdateProductMutation(params: ListProductsParams = {}) {
  const queryClient = useQueryClient()
  // 응답 전에 고칠 listProducts 쿼리. 화면이 보고 있는 쿼리와 같은 인자를 훅에 넘긴다.
  const { queryKey } = listProductsQueryOptions(params)
  return useMutation({
    mutationFn: ({ productId, newProduct }: { productId: number; newProduct: NewProduct }) =>
      updateProduct(productId, newProduct),
    onMutate: async (variables) => {
      // 진행 중인 listProducts 요청의 응답이 고친 값을 덮어쓰지 않도록 취소하고, 되돌릴 값을 남긴다.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (current) =>
        current === undefined ? undefined : applyUpdateProduct(current, variables),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    // 성공하든 실패하든 products Query Domain의 쿼리를 모두 무효화해 서버의 값으로 맞춘다.
    onSettled: () => queryClient.invalidateQueries({ queryKey: productsKeys.all }),
  })
}
