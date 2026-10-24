// 공용 유틸: JSON 다루기(src/shared/lib/text.ts의 머리말).

/**
 * 밖에서 온 글(저장소, 이벤트 데이터 등)을 JSON으로 읽는다. 글이 없거나(null, undefined) JSON이 아니면 undefined다.
 * 읽은 값의 모양은 보지 않으므로 명세의 Zod 스키마 등으로 따로 검사한다.
 */
export function parseJson(text: string | null | undefined): unknown {
  if (text === null || text === undefined) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
