// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/extensions.json, recipes/auth/extensions.json, recipes/dark-mode/extensions.json, recipes/i18n/extensions.json, archetypes/dashboard/extensions.json

import type { ReactNode } from 'react'
import { DashboardLink } from '@/features/dashboard-nav/dashboard-link'
import { LocaleSwitcher } from '@/features/locale-switcher/locale-switcher'
import { ThemeSwitcher } from '@/features/theme-switcher/theme-switcher'
import { UserMenu } from '@/features/user-menu/user-menu'
import { I18nProvider } from '@/shared/i18n/i18n-provider'
import { QueryProvider } from '@/shared/query-client/query-provider'
import { ThemeProvider } from '@/shared/theme/theme-provider'
import { ToastProvider } from '@/shared/ui/toast'

// Starter를 만들 때 Generator가 Base와 Recipe가 더한 조각을 모아 만든 파일이다. 이제는 이 프로젝트의 코드이므로 직접 고친다.
// Provider는 위에 적힌 것이 바깥을 감싸고, 머리글 항목은 위에 적힌 것이 앞에 놓인다.

/** 루트 레이아웃(src/app/layout.tsx)이 모든 페이지를 감싸는 껍데기: 앱 전체의 Provider와 모든 페이지 위의 머리글 */
export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryProvider>
          <ToastProvider>
            <header className="flex justify-end gap-4 p-4">
              <DashboardLink />
              <ThemeSwitcher />
              <UserMenu />
              <LocaleSwitcher />
            </header>
            {children}
          </ToastProvider>
        </QueryProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
