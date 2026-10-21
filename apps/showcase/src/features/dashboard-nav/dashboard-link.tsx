// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/features/dashboard-nav/dashboard-link.tsx

import Link from 'next/link'
import { DASHBOARD_PATH } from '@/shared/dashboard/dashboard-routes'

/**
 * 모든 페이지 위의 머리글에 놓이는 대시보드 링크(확장 지점 header). 로그인하지 않았으면 대시보드가 로그인 페이지로 보낸 뒤
 * 돌아온다(src/shared/auth/access-rules.ts).
 */
export function DashboardLink() {
  return (
    <nav aria-label="대시보드" className="mr-auto flex items-center">
      <Link
        href={DASHBOARD_PATH}
        className="focus-ring rounded-sm text-sm font-medium underline-offset-4 hover:underline"
      >
        대시보드
      </Link>
    </nav>
  )
}
