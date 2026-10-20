import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { listProducts, createProduct, updateProduct, deleteProduct } from '@/shared/api/generated'
import type { ListProductsParams, NewProduct } from '@/shared/api/generated/model'
import { productsKeys } from './products.keys'

// products Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function listProductsQueryOptions(params: ListProductsParams = {}) {
  return queryOptions({
    queryKey: productsKeys.listProducts(params),
    queryFn: ({ signal }) => listProducts(params, { signal }),
  })
}

export function useCreateProductMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newProduct: NewProduct) => createProduct(newProduct),
    // 성공하면 products Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...productsKeys.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productsKeys.all }),
  })
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, newProduct }: { productId: number; newProduct: NewProduct }) =>
      updateProduct(productId, newProduct),
    // 성공하면 products Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...productsKeys.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productsKeys.all }),
  })
}

export function useDeleteProductMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (productId: number) => deleteProduct(productId),
    // 성공하면 products Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...productsKeys.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productsKeys.all }),
  })
}
