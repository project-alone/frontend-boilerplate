import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AppShell } from './app-shell'
import '@/shared/ui/styles.css'

export const metadata: Metadata = {
  title: 'Starter',
}

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
