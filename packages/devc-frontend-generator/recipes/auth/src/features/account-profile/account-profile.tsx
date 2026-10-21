'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { getMeQueryOptions } from '@/queries/auth/auth.queries'
import type { Role } from '@/shared/api/generated/model'
import { Button } from '@/shared/ui/button'

const ROLE_LABELS: Record<Role, string> = { admin: '관리자', user: '사용자' }

/**
 * 로그인한 사용자의 정보(백엔드의 getMe). 서버가 prefetch한 데이터를 이어받고, "다시 불러오기"를 누르면 브라우저가 BFF 프록시로
 * 다시 요청한다. accessToken이 만료되었으면 프록시가 refresh한 뒤 다시 보내므로 다시 로그인하지 않아도 된다.
 */
export function AccountProfile() {
  const { data: user, refetch, isFetching, isRefetchError } = useSuspenseQuery(getMeQueryOptions())

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="font-medium">이름</dt>
        <dd>{user.name}</dd>
        <dt className="font-medium">이메일</dt>
        <dd>{user.email}</dd>
        <dt className="font-medium">역할</dt>
        <dd>{user.roles.map((role) => ROLE_LABELS[role]).join(', ')}</dd>
      </dl>
      {isRefetchError && (
        <p role="alert" className="text-sm text-danger">
          정보를 다시 불러오지 못했습니다. 다시 로그인해 주세요.
        </p>
      )}
      <div>
        <Button variant="secondary" disabled={isFetching} onClick={() => void refetch()}>
          다시 불러오기
        </Button>
      </div>
    </div>
  )
}
