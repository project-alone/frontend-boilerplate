// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/dark-mode/src/shared/theme/theme.test.ts

import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { readThemeChoice, saveThemeChoice, THEME_STORAGE_KEY, watchTheme } from './theme'

// jsdom에는 matchMedia가 없으므로 운영체제의 다크 모드 설정을 흉내 낸다.
let systemDark: boolean
const mediaListeners = new Set<() => void>()

function changeSystemTheme(dark: boolean) {
  systemDark = dark
  for (const listener of mediaListeners) listener()
}

function appliedTheme() {
  return document.documentElement.dataset['theme']
}

beforeEach(() => {
  systemDark = false
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return query === '(prefers-color-scheme: dark)' && systemDark
      },
      addEventListener: (_type: 'change', listener: () => void) => mediaListeners.add(listener),
      removeEventListener: (_type: 'change', listener: () => void) => mediaListeners.delete(listener),
    }) as unknown as MediaQueryList
})

afterEach(() => {
  localStorage.clear()
  mediaListeners.clear()
  delete document.documentElement.dataset['theme']
})

test('고른 테마가 없으면 시스템 설정이다', () => {
  expect(readThemeChoice()).toBe('system')
})

test('알 수 없는 값이 저장되어 있으면 시스템 설정으로 본다', () => {
  localStorage.setItem(THEME_STORAGE_KEY, 'sepia')

  expect(readThemeChoice()).toBe('system')
})

test('다크를 고르면 저장하고, 운영체제가 라이트 모드여도 다크 테마를 적용한다', () => {
  saveThemeChoice('dark')

  expect(readThemeChoice()).toBe('dark')
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  expect(appliedTheme()).toBe('dark')
})

test('시스템 설정을 고르면 저장한 선택을 지우고 운영체제 설정을 따른다', () => {
  systemDark = true
  saveThemeChoice('light')
  expect(appliedTheme()).toBe('light')

  saveThemeChoice('system')

  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  expect(appliedTheme()).toBe('dark')
})

test('시스템 설정을 따르는 동안 운영체제 설정이 바뀌면 테마도 바뀐다', () => {
  const onChange = vi.fn()
  const unwatch = watchTheme(onChange)

  changeSystemTheme(true)
  expect(appliedTheme()).toBe('dark')
  changeSystemTheme(false)
  expect(appliedTheme()).toBe('light')
  expect(onChange).toHaveBeenCalledTimes(2)

  unwatch()
})

test('테마를 직접 골랐으면 운영체제 설정이 바뀌어도 그대로다', () => {
  const unwatch = watchTheme(() => undefined)
  saveThemeChoice('light')

  changeSystemTheme(true)

  expect(appliedTheme()).toBe('light')
  unwatch()
})

test('다른 탭에서 고른 테마를 이 탭에도 적용한다', () => {
  const onChange = vi.fn()
  const unwatch = watchTheme(onChange)

  // 다른 탭이 저장소를 바꾸면 브라우저가 storage 이벤트를 보낸다.
  localStorage.setItem(THEME_STORAGE_KEY, 'dark')
  window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }))

  expect(appliedTheme()).toBe('dark')
  expect(onChange).toHaveBeenCalledOnce()
  unwatch()
})

test('구독을 끊으면 더는 테마를 바꾸지 않는다', () => {
  const onChange = vi.fn()
  watchTheme(onChange)()

  changeSystemTheme(true)

  expect(onChange).not.toHaveBeenCalled()
  expect(appliedTheme()).toBeUndefined()
})
