// JSON으로 읽은 값이나 사용자가 넘긴 값의 타입을 좁히는 범용 함수

/** JSON의 객체인지 본다(배열과 null은 아니다). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/** value가 values(`as const`로 적은 선택지 목록 등) 가운데 하나인지 본다. */
export function isOneOf<const T>(values: readonly T[], value: unknown): value is T {
  return values.some((candidate) => candidate === value)
}
