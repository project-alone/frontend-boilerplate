// 사용자 현황의 숫자와 차트가 함께 쓰는 표기

const countFormat = new Intl.NumberFormat('ko-KR')

/** 1200 → 1,200명 */
export function formatPeople(count: number): string {
  return `${countFormat.format(count)}명`
}
