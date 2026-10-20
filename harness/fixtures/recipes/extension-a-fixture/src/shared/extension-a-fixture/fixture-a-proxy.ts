import { type NextRequest, NextResponse } from 'next/server'

/**
 * 시험용 proxy 처리기: /fixture-proxy-request에는 앞의 처리기가 고쳐 넘긴 요청의 헤더를 알려 주며 직접 응답하고,
 * 나머지는 다음 처리기에 넘겨 받은 응답에 자기 이름을 덧붙인다.
 */
export async function fixtureAProxy(request: NextRequest, next: () => Promise<NextResponse>): Promise<NextResponse> {
  if (request.nextUrl.pathname === '/fixture-proxy-request') {
    return new NextResponse(null, {
      status: 204,
      headers: { 'x-fixture-seen': request.headers.get('x-fixture-from-b') ?? '' },
    })
  }
  const response = await next()
  response.headers.append('x-fixture-proxy', 'a')
  return response
}
