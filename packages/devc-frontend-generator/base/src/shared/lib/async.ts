// 공용 유틸: 기다리기(src/shared/lib/text.ts의 머리말).

/** ms만큼 기다린다. signal이 abort되면 남은 시간을 기다리지 않고 바로 끝난다(실패하지 않는다). */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted === true) {
      resolve()
      return
    }
    const done = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', done, { once: true })
  })
}
