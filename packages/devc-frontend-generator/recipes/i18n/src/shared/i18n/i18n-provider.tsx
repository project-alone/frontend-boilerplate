'use client'

import { NextIntlClientProvider } from 'next-intl'
import { type ReactNode, useEffect } from 'react'
import { intlConfig } from './messages'
import { useRouteLocale } from './route-locale'
import { routing } from './routing'

/**
 * 클라이언트 컴포넌트가 useTranslations, useFormatter, useLocale과 navigation.ts의 Link를 쓸 수 있게 앱 전체를 감싼다
 * (src/app/app-shell.tsx). locale은 주소의 [locale]이고, 번역하지 않은 페이지([locale] 밖)에서는 기본 locale이다.
 *
 * - 루트 레이아웃은 locale을 모르므로(<html lang="ko">) 페이지를 옮길 때마다 <html lang>을 지금 locale로 바꾼다. 브라우저가
 *   JavaScript를 실행하기 전에는 src/app/[locale]/layout.tsx가 페이지 내용을 감싼 <div lang>이 언어를 알린다.
 * - 루트 레이아웃 아래에서는 어느 locale의 페이지가 올지 모르므로 모든 locale의 카탈로그가 브라우저 번들에 들어간다.
 *   카탈로그가 커지면 클라이언트 컴포넌트가 쓰는 namespace만 따로 나눈다(README의 "다국어(i18n)").
 */
export function I18nProvider({ children }: Readonly<{ children: ReactNode }>) {
  const locale = useRouteLocale() ?? routing.defaultLocale

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <NextIntlClientProvider {...intlConfig(locale)}>{children}</NextIntlClientProvider>
}
