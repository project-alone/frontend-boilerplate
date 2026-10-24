// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/dark-mode/src/shared/theme/theme.ts

/*
 * 테마(라이트, 다크) 선택과 적용. 고른 테마는 <html data-theme="light|dark">로 드러나고,
 * src/shared/ui/tokens-dark.css가 data-theme="dark"일 때 토큰 값을 바꾼다. 컴포넌트는 고치지 않는다.
 */

export const THEME_CHOICES = ['system', 'light', 'dark'] as const

/** 사용자가 고른 테마. system이면 운영체제 설정(prefers-color-scheme)을 따른다. */
export type ThemeChoice = (typeof THEME_CHOICES)[number]

/** 테마 전환 UI에 보이는 이름 */
export const THEME_LABELS: Record<ThemeChoice, string> = {
  system: '시스템 설정',
  light: '라이트',
  dark: '다크',
}

/** 고른 테마를 저장하는 localStorage 키. system을 고르면 지운다. */
export const THEME_STORAGE_KEY = 'theme'

// 같은 탭에서 테마를 고른 것을 알리는 이벤트. 다른 탭에서 고른 것은 storage 이벤트로 알 수 있다.
const THEME_CHANGE_EVENT = 'theme-change'

// 운영체제의 다크 모드 설정. applyTheme은 inline script로도 실행하므로 이 상수 대신 같은 값을 직접 적는다.
const DARK_QUERY = '(prefers-color-scheme: dark)'

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.some((choice) => choice === value)
}

// readStoredTheme과 applyTheme은 첫 화면을 그리기 전에 inline script로도 실행하므로(THEME_SCRIPT)
// 함수 밖의 이름을 쓰지 않는다.

/** 저장된 테마 선택을 읽는다. 저장소를 쓸 수 없으면(예: 브라우저가 사이트 데이터를 막은 경우) null이다. */
export function readStoredTheme(storageKey: string): string | null {
  try {
    return window.localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

/** 테마 선택을 <html data-theme>에 적는다. light, dark가 아니면 운영체제 설정을 따른다. */
export function applyTheme(choice: string | null): void {
  const dark = choice === 'dark' || (choice !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset['theme'] = dark ? 'dark' : 'light'
}

/**
 * 저장된 테마를 첫 화면을 그리기 전에 적용하는 inline script. <body>의 맨 앞에 넣는다(ThemeScript, ThemeProvider).
 * React가 뜬 뒤에 적용하면 잠깐 다른 테마가 보이므로(깜빡임) 앱 코드를 기다리지 않는다.
 */
export const THEME_SCRIPT = `(${applyTheme.toString()})((${readStoredTheme.toString()})(${JSON.stringify(THEME_STORAGE_KEY)}))`

/** 고른 테마. 저장된 값이 없거나 알 수 없는 값이면 system이다. */
export function readThemeChoice(): ThemeChoice {
  const stored = readStoredTheme(THEME_STORAGE_KEY)
  return isThemeChoice(stored) ? stored : 'system'
}

/** 테마를 골라 저장하고 적용한다. 저장하지 못하면(예: 사이트 데이터 차단) 지금 화면에만 적용된다. */
export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // 저장하지 못해도 아래에서 지금 화면에는 적용한다.
  }
  applyTheme(choice)
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}

/**
 * 테마 선택(이 탭이나 다른 탭에서)이나 운영체제 설정이 바뀌면 onChange를 부른다. 다른 탭에서 고른 테마와 바뀐 운영체제
 * 설정은 이 탭에도 적용한다. 구독을 끊는 함수를 돌려준다. useSyncExternalStore의 subscribe로 쓸 수 있다.
 */
export function watchTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY)
  const reapply = () => {
    applyTheme(readThemeChoice())
    onChange()
  }
  const reapplyOnStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) reapply()
  }
  media.addEventListener('change', reapply)
  window.addEventListener('storage', reapplyOnStorage)
  // 이 탭에서 고른 테마는 saveThemeChoice가 이미 적용했다.
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  return () => {
    media.removeEventListener('change', reapply)
    window.removeEventListener('storage', reapplyOnStorage)
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
  }
}
