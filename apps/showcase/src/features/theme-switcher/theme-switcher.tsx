// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/dark-mode/src/features/theme-switcher/theme-switcher.tsx

'use client'

import { useSyncExternalStore } from 'react'
import {
  isThemeChoice,
  readThemeChoice,
  saveThemeChoice,
  THEME_CHOICES,
  THEME_LABELS,
  type ThemeChoice,
  watchTheme,
} from '@/shared/theme/theme'
import { Select } from '@/shared/ui/select'

const OPTIONS = THEME_CHOICES.map((choice) => ({ value: choice, label: THEME_LABELS[choice] }))

/** 테마(시스템 설정, 라이트, 다크)를 고른다. 고른 테마는 브라우저에 저장되어 다음 방문에도 쓰인다. */
export function ThemeSwitcher() {
  // 서버는 저장된 선택을 모르므로 system으로 그리고, 브라우저에서 저장된 선택으로 바꾼다.
  // 화면의 테마는 ThemeScript가 이미 적용해 두었으므로 깜빡이지 않는다.
  const choice = useSyncExternalStore(watchTheme, readThemeChoice, (): ThemeChoice => 'system')

  return (
    <Select
      label="테마"
      options={OPTIONS}
      value={choice}
      onValueChange={(value) => {
        if (isThemeChoice(value)) saveThemeChoice(value)
      }}
    />
  )
}
