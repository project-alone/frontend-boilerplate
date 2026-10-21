// 브라우저의 MSW(서비스 워커)가 요청을 받을 준비가 되었는지 알린다(README의 "API 목킹(MSW)").
// instrumentation-client와 앱 코드가 이 모듈을 따로 불러와도 같은 값을 보도록 모듈 변수 대신 페이지의 globalThis에 둔다.
const pageState = globalThis as typeof globalThis & { starterMockReadiness?: Promise<void> }

/**
 * 브라우저의 MSW를 켜는 쪽(Rendering Mode static-export의 src/shared/mocks/browser-instrumentation.ts)이, 서비스 워커가 요청을 받을
 * 준비가 되면 끝나는 약속을 알린다. 앱 코드보다 먼저 실행되는 instrumentation-client에서 부른다.
 */
export function setMockReadiness(ready: Promise<void>): void {
  pageState.starterMockReadiness = ready
}

/**
 * 브라우저의 MSW(서비스 워커)가 요청을 받을 준비가 되면 끝난다. 목을 끈 빌드, 서비스 워커를 쓰지 않는 Rendering Mode server,
 * 서버, Vitest에서는 바로 끝난다. 서비스 워커를 띄우지 못하면 그 오류로 실패한다.
 *
 * 서비스 워커가 준비되기 전에 나간 요청은 MSW가 받지 못하고 실제 네트워크로 나간다. fetch는 browser-instrumentation.ts가 준비될
 * 때까지 붙잡아 두지만, XMLHttpRequest, EventSource, WebSocket처럼 그 밖의 방법으로 보내는 요청은 붙잡을 수 없다. 페이지를 연
 * 직후에 이런 요청을 보낼 수 있는 코드는 이 함수를 기다린 뒤 보낸다(예: file-upload Recipe의 apiUpload, realtime Recipe의 이벤트
 * 스트림).
 */
export function waitForMocks(): Promise<void> {
  return pageState.starterMockReadiness ?? Promise.resolve()
}
