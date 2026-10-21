// @vitest-environment node
import { NextRequest, NextResponse } from 'next/server'
import { expect, test, vi } from 'vitest'
import { i18nProxy } from './i18n-proxy'

// 이 파일은 요청이 라우트에 닿기 전에 서버(Next.js Proxy)에서 실행되는 처리기를 Node.js에서 시험한다.

/** 브라우저가 path로 보낸 페이지 요청. headers로 저장한 locale(cookie)과 브라우저 언어(accept-language)를 흉내 낸다. */
function pageRequest(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, 'http://localhost'), { headers })
}

/** 뒤의 처리기와 라우트. 불렸는지 보려고 응답에 표시를 남긴다. */
function routeHandler() {
  return vi.fn(() => Promise.resolve(NextResponse.next({ headers: { 'x-route': 'reached' } })))
}

test.each([
  ['브라우저 언어가 영어이면 영어', { 'accept-language': 'en-US,en;q=0.9' }, '/en'],
  ['브라우저 언어가 한국어이면 한국어', { 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8' }, '/ko'],
  ['브라우저 언어를 지원하지 않으면 기본 locale(ko)', { 'accept-language': 'ja-JP' }, '/ko'],
  [
    '저장한 locale이 있으면 브라우저 언어보다 저장한 locale',
    { cookie: 'NEXT_LOCALE=en', 'accept-language': 'ko' },
    '/en',
  ],
])('홈(/)은 고른 locale의 홈으로 보낸다: %s', async (_, headers, location) => {
  const next = routeHandler()

  const response = await i18nProxy(pageRequest('/', headers), next)

  expect(response.status).toBe(307)
  expect(new URL(response.headers.get('location') ?? '').pathname).toBe(location)
  expect(next).not.toHaveBeenCalled()
})

test('locale이 붙은 주소는 라우트에 넘기고, 그 locale을 다음 방문을 위해 저장한다', async () => {
  const next = routeHandler()

  const response = await i18nProxy(pageRequest('/en/i18n', { 'accept-language': 'ko' }), next)

  expect(next).toHaveBeenCalledOnce()
  expect(response.headers.get('x-route')).toBe('reached')
  expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('en')
})

test('번역하지 않은 페이지([locale] 밖)는 손대지 않고 넘긴다', async () => {
  const next = routeHandler()

  const response = await i18nProxy(pageRequest('/products', { 'accept-language': 'en' }), next)

  expect(next).toHaveBeenCalledOnce()
  expect(response.headers.get('x-route')).toBe('reached')
  expect(response.headers.get('location')).toBeNull()
  expect(response.cookies.get('NEXT_LOCALE')).toBeUndefined()
})
