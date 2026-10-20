// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/extensions.json

import { type NextRequest, NextResponse } from 'next/server'
import { i18nProxy } from '@/shared/i18n/i18n-proxy'

// Starter를 만들 때 Generator가 Base와 Recipe가 더한 조각을 모아 만든 파일이다. 이제는 이 프로젝트의 코드이므로 직접 고친다.
// 페이지 요청이 라우트에 닿기 전에 처리기를 위에서부터 차례로 실행한다(Next.js Proxy). 처리기는 응답을 직접 돌려주어
// 요청을 끝내거나(뒤의 처리기와 라우트는 실행되지 않는다), next()로 다음 처리기에 넘긴 뒤 받은 응답을 고쳐 돌려준다.
// next(request)로 헤더·쿠키를 고친 요청을 넘기면 뒤의 처리기와 라우트가 그 요청을 받는다.
type ProxyHandler = (
  request: NextRequest,
  next: (request?: NextRequest) => Promise<NextResponse>,
) => NextResponse | Promise<NextResponse>

const handlers: readonly ProxyHandler[] = [i18nProxy]

export function proxy(request: NextRequest): Promise<NextResponse> {
  const run = (index: number, current: NextRequest): Promise<NextResponse> => {
    const handler = handlers[index]
    if (handler !== undefined) return Promise.resolve(handler(current, (next = current) => run(index + 1, next)))
    // 처리기가 고친 요청의 헤더(쿠키 포함)를 라우트에 넘긴다.
    return Promise.resolve(
      current === request ? NextResponse.next() : NextResponse.next({ request: { headers: current.headers } }),
    )
  }
  return run(0, request)
}

export const config = {
  // API 라우트(/api), Next.js가 내주는 파일(/_next), 확장자가 있는 파일(public의 파일 등)에는 실행하지 않는다.
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
