import { renderHook } from '@testing-library/react'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { intlConfig, MESSAGES } from './messages'
import { routing } from './routing'

/** 메시지 카탈로그의 키를 모두 점으로 이어 늘어놓는다(예: HomePage.title). */
function keysOf(messages: object, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]: [string, unknown]) =>
    typeof value === 'object' && value !== null ? keysOf(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  )
}

test.each(routing.locales)('%s 카탈로그는 기본 locale(ko) 카탈로그와 같은 키를 가진다', (locale) => {
  expect(keysOf(MESSAGES[locale]).sort()).toEqual(keysOf(MESSAGES.ko).sort())
})

test('없는 메시지 키는 타입 오류이고, 실행 중에는 키를 대신 보여 주며 오류를 알린다', () => {
  const onError = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider {...intlConfig('ko')} onError={onError}>
      {children}
    </NextIntlClientProvider>
  )
  const { result } = renderHook(() => useTranslations('HomePage'), { wrapper })
  const t = result.current

  expect(t('title')).toBe('Starter')
  // @ts-expect-error -- HomePage에 없는 키. 메시지 키는 카탈로그(ko.json)의 타입으로 검사하므로 npm run typecheck가 이 줄에서
  // 오류를 낸다. 오류가 나지 않으면(키 검사가 꺼지면) 이 주석 때문에 typecheck가 실패한다.
  expect(t('titel')).toBe('HomePage.titel')
  expect(onError).toHaveBeenCalledOnce()
})
