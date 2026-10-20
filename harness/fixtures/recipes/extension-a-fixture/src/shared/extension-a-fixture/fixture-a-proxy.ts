import type { NextRequest, NextResponse } from 'next/server'

/** 시험용 proxy 처리기: 다음 처리기에 넘겨 받은 응답에 자기 이름을 덧붙인다. */
export async function fixtureAProxy(_request: NextRequest, next: () => Promise<NextResponse>): Promise<NextResponse> {
  const response = await next()
  response.headers.append('x-fixture-proxy', 'a')
  return response
}
