import 'server-only'
import createMiddleware from 'next-intl/middleware'
import type { NextRequest, NextResponse } from 'next/server'
import { routing } from './routing'

// next-intl의 proxy(middleware). 주소의 locale, 저장한 locale(NEXT_LOCALE 쿠키), 브라우저 언어(Accept-Language), 기본 locale
// 순으로 locale을 고르고, 고른 locale을 쿠키에 저장한다.
const handleI18nRouting = createMiddleware(routing)

/** next-intl이 다룰 요청: locale을 골라야 하는 홈(/)과 locale이 붙은 주소(/en, /en/i18n) */
function isLocaleRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    routing.locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`))
  )
}

/**
 * i18n Recipe의 proxy 처리기(src/proxy.ts). 홈(/)은 고른 locale의 홈(/ko, /en)으로 보내고, locale이 붙은 주소는 그대로 라우트에
 * 넘기며 그 locale을 저장한다. 번역하지 않은 페이지([locale] 밖)는 손대지 않는다. 요청을 받는 서버가 없는 static-export
 * Starter에는 proxy가 없으므로 홈(/)은 기본 locale의 홈을 보여 준다(src/app/page.tsx).
 */
export async function i18nProxy(request: NextRequest, next: () => Promise<NextResponse>): Promise<NextResponse> {
  if (!isLocaleRoute(request.nextUrl.pathname)) return next()

  const routed = handleI18nRouting(request)
  // 고른 locale의 주소로 보낸다. 뒤의 처리기와 라우트는 실행하지 않는다.
  if (routed.headers.has('location')) return routed

  // locale이 붙은 주소는 next-intl이 손대지 않고 넘긴다. next-intl이 응답에 붙인 locale 쿠키만 뒤에서 받은 응답에 옮긴다.
  const response = await next()
  for (const cookie of routed.cookies.getAll()) response.cookies.set(cookie)
  return response
}
