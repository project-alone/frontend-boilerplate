import { type NextRequest, NextResponse } from 'next/server'

/** 시험용 proxy 처리기: /fixture-proxy-stop에는 직접 응답하고(뒤의 처리기와 라우트는 실행되지 않는다), 나머지는 다음 처리기에 넘긴다. */
export async function fixtureBProxy(request: NextRequest, next: () => Promise<NextResponse>): Promise<NextResponse> {
  if (request.nextUrl.pathname === '/fixture-proxy-stop') {
    return new NextResponse(null, { status: 204, headers: { 'x-fixture-proxy-stopped-by': 'b' } })
  }
  const response = await next()
  response.headers.append('x-fixture-proxy', 'b')
  return response
}
