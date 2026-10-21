// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/app/dashboard/not-found.tsx

import Link from 'next/link'
import { USERS_PATH } from '@/shared/dashboard/dashboard-routes'

// /dashboard 아래에서 없는 주소나 없는 사용자(예: /dashboard/users/<없는 id>/edit의 notFound())를 찾을 때 보이는 화면.
// 대시보드 안의 이동(layout.tsx)은 그대로 남는다.
export default function DashboardNotFound() {
  return (
    <main className="flex flex-col items-start gap-4 p-4">
      <h1 className="text-lg font-semibold">찾는 화면이 없습니다</h1>
      <p>주소가 바뀌었거나 사용자가 없어졌을 수 있습니다.</p>
      <Link href={USERS_PATH} className="focus-ring rounded-sm underline underline-offset-4">
        사용자 목록으로
      </Link>
    </main>
  )
}
