// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/app/layout.tsx, recipes/dark-mode/src/app/layout.tsx.patch

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ThemeSwitcher } from '@/features/theme-switcher/theme-switcher'
import { QueryProvider } from '@/shared/query-client/query-provider'
import { ThemeScript } from '@/shared/theme/theme-script'
import { ToastProvider } from '@/shared/ui/toast'
import '@/shared/ui/styles.css'

export const metadata: Metadata = {
  title: 'Starter',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // ThemeScript가 첫 화면 전에 <html>에 data-theme을 붙이므로 그 속성의 hydration 불일치 경고를 끈다.
    <html lang="ko" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <QueryProvider>
          <ToastProvider>
            <header className="flex justify-end p-4">
              <ThemeSwitcher />
            </header>
            {children}
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
