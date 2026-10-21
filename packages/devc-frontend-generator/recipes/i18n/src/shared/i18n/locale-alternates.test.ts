import { expect, test } from 'vitest'
import { localeAlternates, localeOpenGraph } from './locale-alternates'

test('번역한 페이지는 자기 주소를 canonical로, 같은 페이지의 locale별 주소를 언어별 주소로, 기본 locale의 주소를 x-default로 알린다', () => {
  expect(localeAlternates('/')).toEqual({ canonical: './', languages: { ko: '/ko', en: '/en', 'x-default': '/ko' } })
  expect(localeAlternates('/i18n')).toEqual({
    canonical: './',
    languages: { ko: '/ko/i18n', en: '/en/i18n', 'x-default': '/ko/i18n' },
  })
})

test('번역한 페이지의 og:locale은 그 locale이고, 위 레이아웃이 정한 OpenGraph는 그대로 둔다', () => {
  // Next.js가 풀어 둔 위 레이아웃의 OpenGraph(예: seo Recipe의 기본값)
  const parent: Parameters<typeof localeOpenGraph>[0] = {
    type: 'website',
    title: { absolute: '', template: null },
    siteName: 'Starter',
    locale: 'ko_KR',
    url: 'https://www.example.com/en',
  }

  expect(localeOpenGraph(parent, 'en')).toEqual({ ...parent, locale: 'en_US' })
  expect(localeOpenGraph(null, 'ko')).toEqual({ locale: 'ko_KR' })
})
