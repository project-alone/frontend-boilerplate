// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/queries/users/users.queries.ts

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { listUsers, getUserStats, getUser, createUser, updateUser } from '@/shared/api/generated'
import type { ListUsersParams, NewUserAccount, UserAccountUpdate } from '@/shared/api/generated/model'
import { usersKeys } from './users.keys'

// users Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function listUsersQueryOptions(params: ListUsersParams = {}) {
  return queryOptions({
    queryKey: usersKeys.listUsers(params),
    queryFn: ({ signal }) => listUsers(params, { signal }),
  })
}

export function getUserStatsQueryOptions() {
  return queryOptions({
    queryKey: usersKeys.getUserStats(),
    queryFn: ({ signal }) => getUserStats({ signal }),
  })
}

export function getUserQueryOptions(userId: number) {
  return queryOptions({
    queryKey: usersKeys.getUser(userId),
    queryFn: ({ signal }) => getUser(userId, { signal }),
  })
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newUserAccount: NewUserAccount) => createUser(newUserAccount),
    // 성공하면 users Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...usersKeys.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKeys.all }),
  })
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, userAccountUpdate }: { userId: number; userAccountUpdate: UserAccountUpdate }) =>
      updateUser(userId, userAccountUpdate),
    // 성공하면 users Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...usersKeys.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKeys.all }),
  })
}
