// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/features/user-stats/user-stats-format.ts

// 사용자 현황의 숫자와 차트가 함께 쓰는 표기

const countFormat = new Intl.NumberFormat('ko-KR')

/** 1200 → 1,200명 */
export function formatPeople(count: number): string {
  return `${countFormat.format(count)}명`
}
