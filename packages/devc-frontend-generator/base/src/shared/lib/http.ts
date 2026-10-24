// 공용 유틸: HTTP 요청·응답 다루기(src/shared/lib/text.ts의 머리말). fetch 클라이언트(apiFetch 등)와 직접 만든 MSW 핸들러가 쓴다.

/**
 * 응답 본문의 글을 Content-Type에 맞게 읽는다. JSON이면 JSON으로, 아니면 글 그대로 읽고, 본문이 없으면 undefined다.
 * JSON이라고 하고 JSON이 아니면 실패한다(SyntaxError).
 */
export function parseBody(text: string, contentType: string | null | undefined): unknown {
  if (text === '') return undefined
  return contentType?.includes('json') === true ? JSON.parse(text) : text
}

/** 요청 본문을 JSON으로 읽는다. 본문이 없거나 JSON이 아니면 undefined다. 읽은 값은 명세의 Zod 스키마로 검사한다. */
export function readJsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => undefined)
}

/**
 * 주소의 쿼리 파라미터를 객체로 읽는다. 쿼리 파라미터는 모두 문자열로 오므로 numberNames의 파라미터(예: page, pageSize)는
 * 숫자로 바꾼다. 명세의 파라미터 스키마(예: ListMembersParams)로 검사하기 전에 쓴다.
 */
export function searchParamsOf(url: URL, numberNames: readonly string[] = []): Record<string, unknown> {
  const params: Record<string, unknown> = Object.fromEntries(url.searchParams)
  for (const name of numberNames) {
    const value = params[name]
    if (typeof value === 'string') params[name] = Number(value)
  }
  return params
}
