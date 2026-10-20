// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/app/account/page.tsx

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { AccountProfile } from '@/features/account-profile/account-profile'
import { getMeQueryOptions } from '@/queries/auth/auth.queries'
import { requireServerSession } from '@/shared/auth/server-session'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '내 정보',
}

// auth Recipe: 로그인한 사용자만 들어오는 보호된 라우트(src/shared/auth/access-rules.ts). 서버 컴포넌트가 세션의 accessToken을
// 붙여 백엔드를 직접 불러(getMe) prefetch하고, 클라이언트 컴포넌트가 hydration으로 이어받는다. "다시 불러오기"는 브라우저가
// BFF 프록시로 요청하고, 프록시가 쿠키의 accessToken을 붙인다.
export default async function AccountPage() {
  // 데이터를 가져오기 전에 세션을 읽어야 이 렌더링의 API 요청에 accessToken이 붙는다.
  await requireServerSession()
  const queryClient = getQueryClient()
  await queryClient.query(getMeQueryOptions())

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">내 정보</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AccountProfile />
      </HydrationBoundary>
    </main>
  )
}
