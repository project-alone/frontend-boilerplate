import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { DashboardNav } from '@/features/dashboard-nav/dashboard-nav'

// /dashboard 아래 페이지는 모두 검색 결과에 보이지 않을 페이지다(auth Recipe의 보호된 라우트처럼).
export const metadata: Metadata = {
  title: { template: '%s | 대시보드', default: '대시보드' },
  robots: { index: false },
}

// 대시보드 Archetype: /dashboard 아래의 모든 화면 위에 대시보드 안의 이동(개요, 사용자)을 둔다. 대시보드는 로그인한 사용자만,
// 사용자를 추가하고 고치는 화면은 관리자만 들어온다(src/shared/auth/access-rules.ts의 PROTECTED_ROUTES). 이 규칙의 경로는
// sitemap을 만드는 Recipe(seo)가 있으면 sitemap에서도 빠진다(auth Recipe의 sitemap 규칙).
export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex flex-col">
      <DashboardNav />
      {children}
    </div>
  )
}
