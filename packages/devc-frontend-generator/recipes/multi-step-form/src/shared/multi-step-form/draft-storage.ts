import * as z from 'zod'

// multi-step-form Recipe: 다단계 폼이 입력하던 값과 단계를 sessionStorage에 둔다. 페이지를 새로 고쳐도 이어서 입력하고,
// 탭을 닫으면 지워진다. 다른 탭이나 다음 방문에는 남지 않도록 localStorage는 쓰지 않는다.
// 비밀번호, 카드 번호 같은 비밀 값은 저장하지 않는다(그런 필드가 있는 폼에서는 저장하기 전에 뺀다).

/** 저장한 입력. step은 0부터 센 단계, values는 모든 단계에서 입력한 값이다. */
export interface StoredDraft {
  step: number
  values: Record<string, string | number | boolean>
}

// 저장소의 값은 다른 버전의 앱이 썼거나 사람이 고쳤을 수 있으므로 읽을 때 모양을 검사한다(외부 데이터).
const StoredDraftSchema = z.object({
  step: z.int().nonnegative(),
  values: z.record(z.string(), z.unknown()),
})

/**
 * 저장한 입력을 읽는다. 없거나 모양이 다르면 undefined다. 입력 요소에 넣을 수 없는 값(객체, 배열, null 등)은 뺀다.
 * 값이 폼의 검증 규칙에 맞는지는 보지 않는다. 그 단계에서 다음으로 넘어갈 때, 그리고 제출할 때 검증한다.
 */
export function readDraft(key: string): StoredDraft | undefined {
  const parsed = StoredDraftSchema.safeParse(parseJson(readStorage(key)))
  if (!parsed.success) return undefined
  const values = Object.fromEntries(
    Object.entries(parsed.data.values).filter(
      (entry): entry is [string, string | number | boolean] =>
        typeof entry[1] === 'string' || typeof entry[1] === 'boolean' || Number.isFinite(entry[1]),
    ),
  )
  return { step: parsed.data.step, values }
}

/** 입력을 저장한다. 저장소를 쓸 수 없으면(사생활 보호 모드의 용량 제한 등) 저장하지 않고 넘어간다. */
export function writeDraft(key: string, step: number, values: object): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ step, values }))
  } catch {
    // 저장하지 못해도 폼은 그대로 쓸 수 있다. 새로 고치면 처음부터 입력한다.
  }
}

/** 저장한 입력을 지운다(제출에 성공했을 때). */
export function removeDraft(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // 저장소를 쓸 수 없으면 저장한 것도 없다.
  }
}

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function parseJson(text: string | null): unknown {
  if (text === null) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
