// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/queries/auth/auth.queries.ts

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMe } from '@/shared/api/generated'
import { fetchSessionUser, loginWithCredentials, logoutSession } from '@/shared/auth/auth-client'
import { authKeys } from './auth.keys'

// auth Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

/**
 * 로그인한 사용자(백엔드의 getMe). 서버 컴포넌트에서는 getServerSession()을 먼저 불러야 accessToken이 붙고, 브라우저에서는
 * BFF 프록시가 세션 쿠키의 accessToken을 붙인다.
 */
export function getMeQueryOptions() {
  return queryOptions({
    queryKey: authKeys.getMe(),
    queryFn: ({ signal }) => getMe({ signal }),
  })
}

/** 지금 로그인한 사용자(BFF의 로그인 세션). 로그인하지 않았으면 null이다. 머리글의 사용자 메뉴가 쓴다. */
export function sessionQueryOptions() {
  return queryOptions({
    queryKey: authKeys.session(),
    queryFn: ({ signal }) => fetchSessionUser({ signal }),
  })
}

// 로그인하거나 로그아웃하면 사용자가 바뀌므로 이전 사용자로 받아 둔 캐시를 모두 버린다. 다시 받지는 않는다(무효화하면 로그아웃한
// 뒤 보고 있던 쿼리를 다시 요청해 401을 받는다). 화면은 로그인 페이지나 돌아갈 페이지를 새로 불러 다시 그린다(LoginForm, UserMenu).

export function useLoginMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: loginWithCredentials,
    onSuccess: () => {
      queryClient.clear()
    },
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logoutSession,
    onSuccess: () => {
      queryClient.clear()
    },
  })
}
