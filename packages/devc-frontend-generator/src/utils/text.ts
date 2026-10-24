// 사용자에게 보이는 메시지와 명세에서 읽은 글을 다루는 범용 함수

/** 앞뒤 공백을 뺀 글. 없거나 비었거나 공백뿐이면 undefined다(명세의 summary, title 등). */
export function nonBlank(text: string | undefined): string | undefined {
  const trimmed = text?.trim()
  return trimmed === '' ? undefined : trimmed
}

/** 줄마다 두 칸 들여 써 한 덩어리로 잇는다. 메시지 안에 경로나 이름을 늘어놓을 때 쓴다. */
export function indentLines(lines: readonly string[]): string {
  return lines.map((line) => `  ${line}`).join('\n')
}

/** 요약 줄 아래에 항목을 `- `로 늘어놓은 메시지 */
export function bulletList(summary: string, items: readonly string[]): string {
  return [summary, ...items.map((item) => `- ${item}`)].join('\n')
}

/** 앞과 뒤의 빈 줄(공백뿐인 줄 포함)을 뺀 줄 */
export function trimBlankLines(lines: readonly string[]): string[] {
  const isBlank = (line: string | undefined) => line !== undefined && line.trim() === ''
  const trimmed = [...lines]
  while (isBlank(trimmed[0])) trimmed.shift()
  while (isBlank(trimmed.at(-1))) trimmed.pop()
  return trimmed
}

/** 정렬에 쓰는 글의 비교 함수. 영어의 순서로 비교해 운영체제의 언어 설정과 상관없이 결과가 같다. */
export function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en')
}
