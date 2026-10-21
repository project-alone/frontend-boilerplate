/**
 * 쿼리가 실패해 보여 줄 데이터가 없다. 받아 둔 데이터를 다시 가져오다(창에 돌아왔을 때 등) 실패한 것은 그 데이터를
 * 그대로 보여 주고 다음에 다시 가져오므로, 목록은 이것이 참일 때만 실패를 알린다.
 */
export function failedWithoutData(query: Readonly<{ isError: boolean; data: unknown }>): boolean {
  return query.isError && query.data === undefined
}
