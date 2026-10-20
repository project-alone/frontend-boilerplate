// 통계 차트가 축, 툴팁, 데이터 표에 쓰는 표기. 서버와 브라우저, 사용자의 시간대와 상관없이 같은 글자가 나오도록
// 날짜(YYYY-MM-DD)는 UTC 기준으로 읽는다.

const longDateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: 'UTC' })
const shortDateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })
const countFormat = new Intl.NumberFormat('ko-KR')
const compactFormat = new Intl.NumberFormat('ko-KR', { notation: 'compact' })

/** 2026-10-01 → 10월 1일 */
export function formatLongDate(date: string): string {
  return longDateFormat.format(new Date(date))
}

/** 2026-10-01 → 10. 1. (축 눈금) */
export function formatShortDate(date: string): string {
  return shortDateFormat.format(new Date(date))
}

/** 1320 → 1,320 (축 눈금) */
export function formatCount(value: number): string {
  return countFormat.format(value)
}

/** 1320 → 1,320회 */
export function formatVisits(visits: number): string {
  return `${formatCount(visits)}회`
}

/** 48200000 → 48,200,000원 */
export function formatWon(won: number): string {
  return `${formatCount(won)}원`
}

/** 48200000 → 4820만 (축 눈금) */
export function formatCompact(value: number): string {
  return compactFormat.format(value)
}
