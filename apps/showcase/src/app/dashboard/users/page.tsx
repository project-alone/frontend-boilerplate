// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/app/dashboard/users/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { UserTable } from '@/features/user-table/user-table'
import { requireServerSession } from '@/shared/auth/server-session'
import { canManageUsers, NEW_USER_PATH } from '@/shared/dashboard/dashboard-routes'
import { buttonVariants } from '@/shared/ui/button'

export const metadata: Metadata = {
  title: '사용자',
}

// 대시보드 Archetype의 사용자 목록. 로그인한 사용자 모두 들어오고, 사용자를 추가하고 고치는 링크는 그 화면에 들어갈 수 있는
// 역할(관리자)에게만 보인다. 역할은 서버가 세션에서 읽으므로 요청마다 렌더링한다(SSR). 목록은 테이블의 정렬·필터 상태가 바뀔
// 때마다 브라우저가 BFF 프록시로 다시 가져온다.
export default async function UsersPage() {
  const { user } = await requireServerSession()
  const canManage = canManageUsers(user)

  return (
    <main className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">사용자</h1>
        {canManage && (
          <Link href={NEW_USER_PATH} className={buttonVariants({ size: 'sm' })}>
            사용자 추가
          </Link>
        )}
      </div>
      <UserTable canEdit={canManage} />
    </main>
  )
}
