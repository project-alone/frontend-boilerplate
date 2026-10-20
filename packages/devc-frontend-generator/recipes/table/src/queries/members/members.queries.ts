import { queryOptions } from '@tanstack/react-query'
import { listMembers } from '@/shared/api/generated'
import type { ListMembersParams } from '@/shared/api/generated/model'
import { membersKeys } from './members.keys'

// members Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function listMembersQueryOptions(params: ListMembersParams = {}) {
  return queryOptions({
    queryKey: membersKeys.listMembers(params),
    queryFn: ({ signal }) => listMembers(params, { signal }),
  })
}
