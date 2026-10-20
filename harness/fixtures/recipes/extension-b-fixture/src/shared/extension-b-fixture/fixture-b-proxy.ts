import { NextRequest, NextResponse } from 'next/server'

/**
 * 시험용 proxy 처리기: /fixture-proxy-stop에는 직접 응답하고(뒤의 처리기와 라우트는 실행되지 않는다), 나머지는 요청에
 * 헤더를 더해 다음 처리기에 넘긴 뒤 받은 응답에 자기 이름을 덧붙인다.
 */
export async function fixtureBProxy(
  request: NextRequest,
  next: (request?: NextRequest) => Promise<NextResponse>,
): Promise<NextResponse> {
  if (request.nextUrl.pathname === '/fixture-proxy-stop') {
    return new NextResponse(null, { status: 204, headers: { 'x-fixture-proxy-stopped-by': 'b' } })
  }
  const headers = new Headers(request.headers)
  headers.set('x-fixture-from-b', 'b')
  const response = await next(new NextRequest(request, { headers }))
  response.headers.append('x-fixture-proxy', 'b')
  return response
}
