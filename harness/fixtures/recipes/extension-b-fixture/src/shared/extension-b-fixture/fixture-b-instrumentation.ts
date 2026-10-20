/** 시험용 instrumentation 조각: 서버가 뜰 때 실행된 순서를 서버 출력에 남긴다. */
export const fixtureBInstrumentation = {
  async register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return
    // 비동기 register는 끝날 때까지 기다린 뒤 다음 조각을 실행한다.
    await new Promise((resolve) => setTimeout(resolve, 100))
    console.log('[extension-b-fixture] register')
  },
}
