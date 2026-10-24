// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/multi-step-form/src/shared/multi-step-form/draft-summary.ts

// multi-step-form Recipe: 확인 단계에서 앞 단계들에 입력한 값을 보여 줄 때 쓴다(입점 신청서, 커머스 Archetype의 주문서).

/** 확인 단계에서 입력하지 않은 값 대신 보이는 문구 */
export const NOT_ENTERED = '입력하지 않음'

/** 확인 단계에 보일 값. 비워 둔 입력(빈 문자열, 비운 숫자 입력의 NaN)은 입력하지 않은 것으로 보이고, 숫자는 format으로 쓴다. */
export function displayValue(value: string | number | undefined, format: (value: number) => string = String): string {
  if (value === undefined || value === '' || Number.isNaN(value)) return NOT_ENTERED
  return typeof value === 'number' ? format(value) : value
}
