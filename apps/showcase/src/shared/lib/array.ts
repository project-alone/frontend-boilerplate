// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/lib/array.ts

// 공용 유틸: 배열 다루기(src/shared/lib/text.ts의 머리말).

/** from부터 to까지(둘 다 포함) 1씩 커지는 정수. to가 from보다 작으면 빈 배열이다. */
export function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index)
}

/** 한 쪽에 pageSize개씩 나눌 때 page번째(1부터 센다) 쪽의 항목. 마지막 쪽 뒤의 쪽은 빈 배열이다. */
export function slicePage<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}
