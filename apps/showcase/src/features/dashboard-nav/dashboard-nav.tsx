// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/features/dashboard-nav/dashboard-nav.tsx

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DASHBOARD_PATH, USERS_PATH } from '@/shared/dashboard/dashboard-routes'

const SECTIONS = [
  { href: DASHBOARD_PATH, label: '개요' },
  { href: USERS_PATH, label: '사용자' },
] as const

/** 지금 주소가 속한 대시보드 화면. 사용자 추가·수정은 사용자 화면에 속한다. */
function currentSection(pathname: string): string {
  return pathname === USERS_PATH || pathname.startsWith(`${USERS_PATH}/`) ? USERS_PATH : DASHBOARD_PATH
}

/**
 * 대시보드 안의 화면(개요, 사용자)을 오가는 탭 모양의 이동. 지금 보고 있는 화면은 aria-current="page"로, 사용자 추가·수정처럼
 * 그 화면에 속한 다른 주소에 있으면 aria-current="true"로 알린다.
 */
export function DashboardNav() {
  const pathname = usePathname()
  const current = currentSection(pathname)

  return (
    <nav aria-label="대시보드 화면" className="border-b border-border px-4">
      <ul className="flex gap-4">
        {SECTIONS.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={href === pathname ? 'page' : href === current ? 'true' : undefined}
              data-current={href === current}
              className="focus-ring inline-block border-b-2 border-transparent py-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[current=true]:border-primary data-[current=true]:text-foreground"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
