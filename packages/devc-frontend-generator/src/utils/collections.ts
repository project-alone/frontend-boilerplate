// 배열과 Map을 다루는 범용 함수

/** items를 keyOf의 값마다 묶는다. 키와 키마다의 항목은 items에 처음 나온 순서다. */
export function groupBy<T, K>(items: Iterable<T>, keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, [item])
    else group.push(item)
  }
  return groups
}
