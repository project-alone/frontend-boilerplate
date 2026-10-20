import en from './en.json'
import ko from './ko.json'
import type { Locale } from './routing'

/*
 * 메시지 카탈로그. 기본 locale(ko)의 카탈로그가 메시지 키의 기준이고, 다른 locale의 카탈로그는 같은 키를 가져야 한다
 * (빠진 키는 아래 MESSAGES에서 타입 오류, 남는 키는 messages.test.tsx가 잡는다). 메시지는 ICU 형식으로 쓴다
 * (복수형 {count, plural, ...}, 날짜 {date, date, long}, 숫자 {price, number, ::currency/KRW}).
 */
export type Messages = typeof ko

export const MESSAGES: Readonly<Record<Locale, Messages>> = { ko, en }

/** 날짜·시각을 이 시간대로 보여 준다. 서버(빌드)와 브라우저가 같은 값을 그려야 hydration이 어긋나지 않는다. */
export const TIME_ZONE = 'Asia/Seoul'

// next-intl의 useTranslations, getTranslations가 메시지 키와 locale을 이 타입으로 검사한다. 없는 키를 쓰면 타입 오류다.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale
    Messages: Messages
  }
}
