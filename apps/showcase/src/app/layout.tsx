// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/app/layout.tsx, recipes/seo/src/app/layout.tsx.patch

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { siteMetadata } from '@/shared/seo/metadata'
import { AppShell } from './app-shell'
import '@/shared/ui/styles.css'

// seo Recipe: 사이트 주소(NEXT_PUBLIC_SITE_URL), 제목 뒤의 사이트 이름, 페이지마다 자기 주소를 알리는 canonical·OG·Twitter의
// 기본값(src/shared/seo/metadata.ts). 페이지는 metadata에 title과 description만 적는다.
export const metadata: Metadata = siteMetadata()

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // 첫 화면을 그리기 전에 <html>의 속성을 바꾸는 스크립트(예: dark-mode Recipe의 테마)나 브라우저 확장이 있어도
    // <html> 자신의 속성에 대한 hydration 불일치 경고는 내지 않는다. 하위 요소의 불일치는 그대로 알린다.
    <html lang="ko" suppressHydrationWarning>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
