// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/app/dashboard/users/[userId]/edit/page.tsx

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { UpdateUserForm } from '@/features/user-form/update-user-form'
import { getUserQueryOptions } from '@/queries/users/users.queries'
import { isApiError } from '@/shared/api/api-fetch'
import { requireServerSession } from '@/shared/auth/server-session'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '사용자 수정',
}

interface EditUserPageProps {
  params: Promise<{ userId: string }>
}

// 대시보드 Archetype의 사용자 수정. 관리자만 들어온다(src/shared/auth/access-rules.ts의 /dashboard/users/[userId]/edit).
// 사용자의 지금 값(getUser)은 서버 컴포넌트가 세션의 accessToken을 붙여 가져와(prefetch) 폼에 hydration으로 넘긴다.
export default async function EditUserPage({ params }: EditUserPageProps) {
  // 데이터를 가져오기 전에 세션을 읽어야 이 렌더링의 API 요청에 accessToken이 붙는다.
  await requireServerSession()
  const { userId: userIdParam } = await params
  const userId = Number(userIdParam)
  // 경로의 userId가 정수가 아니거나 그런 사용자가 없으면 없는 페이지로 본다.
  if (!Number.isInteger(userId)) notFound()
  const queryClient = getQueryClient()
  await queryClient.query(getUserQueryOptions(userId)).catch((error: unknown) => {
    if (isApiError(error, 404)) notFound()
    throw error
  })

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">사용자 수정</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <UpdateUserForm userId={userId} />
      </HydrationBoundary>
    </main>
  )
}
