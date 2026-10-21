import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitPartnerApplication } from '@/shared/api/generated'
import type { PartnerApplication } from '@/shared/api/generated/model'
import { partnersKeys } from './partners.keys'

// partners Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function useSubmitPartnerApplicationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (partnerApplication: PartnerApplication) => submitPartnerApplication(partnerApplication),
    // 성공하면 partners Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...partnersKeys.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: partnersKeys.all }),
  })
}
