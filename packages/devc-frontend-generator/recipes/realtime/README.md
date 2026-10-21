## 실시간 이벤트

`realtime` Recipe로 넣었습니다. 백엔드가 Server-Sent Events(SSE, `text/event-stream`)로 보내는 이벤트를 받아 TanStack Query의 캐시를 고치는 패턴입니다. `/realtime` 페이지가 샘플 배송 현황을 보여 주고, 배송이 바뀌거나 접수될 때마다 목록을 다시 요청하지 않고 표가 바뀝니다.

| 위치                                                | 내용                                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/shared/realtime/event-stream.ts`               | 이벤트 스트림 클라이언트(`connectEventStream`). 연결, 이벤트 읽기, 끊기면 기다렸다가 다시 연결                       |
| `src/shared/realtime/use-event-stream.ts`           | 컴포넌트가 화면에 있는 동안 연결하고 연결 상태를 돌려주는 훅                                                         |
| `src/shared/realtime/connection-status.tsx`         | 연결 상태 표시(`role="status"`)                                                                                      |
| `src/queries/deliveries/`                           | `deliveries` Query Domain. 쿼리 키와 queryOptions(`listDeliveries`), 이벤트를 캐시에 반영하는 `deliveries.events.ts` |
| `src/features/delivery-board/`                      | 배송 현황 표와 연결 상태                                                                                             |
| `src/app/realtime/`                                 | `/realtime` 라우트                                                                                                   |
| `src/shared/mocks/deliveries.ts`, `event-stream.ts` | 배송 목록과 이벤트 스트림을 흉내 내는 목 백엔드                                                                      |

### 왜 WebSocket이 아니라 SSE인가

캐시를 고치는 이벤트는 백엔드에서 브라우저로만 흐르고, 브라우저가 바꾸는 것은 지금처럼 REST 요청과 뮤테이션 훅으로 보냅니다. 그래서 양방향인 WebSocket이 필요하지 않고, SSE는 보통의 HTTP 응답이라 다음이 그대로 됩니다.

- Rendering Mode `server`에서 브라우저는 다른 API 요청처럼 BFF 프록시(`/api/proxy/deliveries/events`)를 거쳐 연결하고, 프록시가 백엔드의 스트림을 그대로 흘려보냅니다. 프록시가 토큰을 붙이면(ADR-0006, `auth` Recipe) 이 연결에도 붙으므로 토큰이 브라우저에 나오지 않습니다. Next.js의 Route Handler는 WebSocket 연결을 넘겨주지 못해, WebSocket이면 브라우저가 백엔드에 직접 연결하고 인증도 따로 풀어야 합니다.
- `static-export`에서는 다른 API 요청처럼 `NEXT_PUBLIC_API_BASE_URL`의 백엔드에 직접 연결합니다. 백엔드는 CORS로 이 앱의 출처와 `Last-Event-ID` 요청 헤더를 허용해야 합니다.
- MSW가 보통의 HTTP 핸들러로 흉내 냅니다. Vitest, Next.js 서버(`server`의 BFF 프록시가 부르는 요청), 브라우저의 서비스 워커(`static-export`)가 같은 핸들러를 씁니다.

WebSocket이 꼭 필요하면 `event-stream.ts`를 WebSocket으로 바꾸되 `connectEventStream`의 모양(`onEvent`, `onOpen`, 연결 상태)을 지키면 Query Domain과 화면은 고치지 않아도 됩니다.

### 이벤트가 캐시를 고치는 방식

`useDeliveryEvents()`(`src/queries/deliveries/deliveries.events.ts`)가 이벤트 스트림에 연결하고, 받은 이벤트로 캐시를 고칩니다. 이벤트를 받는 컴포넌트는 쿼리를 그리기만 합니다.

- 이벤트(`delivery.created`, `delivery.updated`)는 바뀐 배송 전체를 담고 오므로 `setQueryData`로 캐시의 목록에서 그 배송만 바꾸거나 맨 앞에 더합니다. 목록을 다시 요청하지 않습니다. 캐시에 있는 것보다 오래된(`updatedAt`이 이른) 이벤트는 반영하지 않습니다.
- 이벤트의 데이터는 명세의 Zod 스키마(`Delivery`)로 검증합니다. 명세와 다르면 캐시를 고칠 수 없으므로 Query Domain(`deliveriesKeys.all`, ADR-0008)을 무효화해 다시 가져옵니다. 모르는 이름의 이벤트는 무시합니다.
- 연결될 때마다(처음 연결 포함) Query Domain을 다시 가져옵니다. 끊긴 동안이나, 처음 연결되기 전에 보낸 목록 요청 뒤에 일어난 변경은 이벤트로 받지 못하기 때문입니다. 가져오는 중이던 요청은 연결되기 전에 보낸 것이라 그 응답을 기다리지 않고 다시 보냅니다.
- 목록을 가져오는 중에 이벤트가 오면, 그 응답은 이벤트보다 먼저 만들어졌을 수 있어 도착하면 방금 고친 캐시를 덮어씁니다. 그래서 그 요청이 끝난 뒤 한 번 더 가져옵니다. 그 사이 이벤트가 몇 번 오든 한 번만 가져오고, 가져오던 요청을 취소하지 않으므로 이벤트가 몰려도 목록을 끝내 받지 못하는 일은 없습니다(덮어쓴 응답이 잠깐 보일 수는 있습니다).

다른 Query Domain에 쓰려면 `deliveries.events.ts`를 복사해 이벤트 이름, 데이터 스키마, 고칠 쿼리 키를 바꿉니다. 이벤트가 바뀐 것 전체를 담지 않고 "무엇이 바뀌었다"만 알리면 `setQueryData` 대신 그 쿼리 키를 무효화합니다.

### 연결과 다시 연결

- `connectEventStream`은 브라우저의 `EventSource` 대신 `fetch`로 스트림을 읽습니다. `EventSource`는 2xx가 아닌 응답을 받으면 다시 연결하지 않고, 다시 연결하는 간격을 정할 수 없기 때문입니다.
- 백엔드가 스트림을 닫거나 연결하지 못하면(2xx가 아닌 응답, `text/event-stream`이 아닌 응답, 네트워크 오류) 기다렸다가 다시 연결합니다. 기다리는 시간은 연달아 실패할 때마다 두 배로 늘고(1초, 2초, 4초, … 최대 30초) 그 절반부터 전부까지에서 무작위로 고릅니다. 백엔드가 다시 뜰 때 브라우저들이 한꺼번에 몰리지 않게 하려는 것입니다. 이벤트를 받았거나 30초 넘게 이어진 연결이 끊기면 처음 대기 시간부터 다시 세고, 연결되자마자 이벤트 없이 끊긴 연결은 실패로 셉니다. 연결을 받자마자 닫는 백엔드나 프록시에 빠르게 다시 연결하며 그때마다 목록을 다시 가져오지 않게 하려는 것입니다. 기다리는 시간을 바꾸려면 `connectEventStream`에 `retryDelay`를 넘깁니다(`useEventStream`이 부르는 곳).
- 다시 연결할 때 마지막으로 받은 이벤트 id를 `Last-Event-ID` 헤더로 보냅니다. 백엔드가 그 뒤의 이벤트를 이어서 보낼 수 있으면 씁니다. 이어서 보내지 않아도 위처럼 다시 가져와 맞춥니다.
- 연결 상태(`실시간 연결 중`, `실시간 연결됨`, `연결이 끊겨 다시 연결하는 중`)는 `ConnectionStatus`가 글자와 점으로 보여 주고, 상태 문구(`role="status"`)라 스크린 리더가 바뀐 상태를 알립니다.

### 백엔드에 바라는 것

- `GET /deliveries/events`처럼 `Accept: text/event-stream` 요청에 `Content-Type: text/event-stream`으로 답하고, 이벤트마다 `event`, `data`(JSON), `id`를 보냅니다(`openapi.yaml`의 `streamDeliveryEvents`).
- 연결하자마자 주석 한 줄(`:`로 시작하는 줄)을 보냅니다. BFF 프록시(Next.js)는 본문의 첫 바이트가 올 때 응답 헤더를 브라우저로 보내므로, 이 줄이 없으면 첫 이벤트가 올 때까지 브라우저가 연결되었는지 알 수 없습니다. 연결을 오래 두는 프록시나 로드 밸런서가 끊지 않도록 주기적으로(예: 15초마다) 주석을 보내고, 앞단의 프록시(nginx 등)가 응답을 모아 두지 않게 합니다(nginx는 `X-Accel-Buffering: no`).

### MSW와 실제 백엔드

- 생성된 MSW 핸들러는 명세의 `example`을 돌려줄 뿐이므로, `src/shared/mocks/deliveries.ts`의 목 백엔드가 `src/shared/mocks/handlers.ts`에서 생성된 핸들러보다 앞에 들어가 이벤트로 바뀐 목록을 돌려줍니다. 개발 서버와 E2E에서는 새로 연 화면마다(`Last-Event-ID` 없이 연결하면) 처음 목록으로 되돌리고, 그 화면이 연결한 뒤 목록을 받은 때부터 1.5초 뒤 D-1002가 배송 중으로 바뀌고, 2.5초 뒤 D-1004가 접수되고, 3.5초 뒤 D-1001이 배송 완료로 바뀌지만 그 이벤트를 보내기 전에 연결이 끊깁니다(다시 연결한 뒤 목록을 다시 가져와야 보입니다). `server`에서는 Next.js 서버의 목 백엔드 하나를 모든 화면이 함께 쓰므로, 화면을 새로 열면 이미 열린 화면도 새 순서의 이벤트를 받습니다.
- MSW의 `sse()`는 핸들러를 만들 때 전역 `EventSource`가 있어야 해서 Node.js(Vitest, Next.js 서버)에서는 쓸 수 없습니다. 그래서 응답 본문을 흘려보내는 보통의 HTTP 핸들러로 흉내 냅니다(`src/shared/mocks/event-stream.ts`). 테스트에서 이벤트를 직접 보내려면 `createMockDeliveryBackend()`로 새 목 백엔드를 만들어 `server.use(...backend.handlers)`로 쓰고 `publish`, `changeSilently`, `disconnect`를 부릅니다.
- 실제 백엔드로 바꾸면 `src/shared/mocks/deliveries.ts`와 `handlers.ts`의 `deliveriesHandlers`를 지웁니다.

### 테스트와 샘플 지우기

- 테스트: `src/shared/realtime/event-stream.test.ts`(이벤트 형식 읽기, 다시 연결과 `Last-Event-ID`, 실패할 때마다 늘어나는 대기 시간, 연결 끊기), `src/features/delivery-board/delivery-board.test.tsx`(이벤트가 목록을 다시 요청하지 않고 캐시를 고침, 오래된 이벤트와 명세와 다른 이벤트, 다시 연결한 뒤 놓친 변경 맞추기, 가져오는 중에 온 이벤트), `connection-status.stories.tsx`(axe 검사), `e2e/realtime.spec.ts`(빌드한 앱에서 실시간 반영, 끊긴 뒤 다시 연결해 맞추기, 운영체제가 라이트·다크 모드일 때의 axe 검사).
- 샘플을 지우려면 `src/app/realtime/`, `src/features/delivery-board/`, `src/queries/deliveries/`, `src/shared/mocks/deliveries.ts`(와 `handlers.ts`의 `deliveriesHandlers`), `e2e/realtime.spec.ts`를 지우고 `openapi.yaml`에서 `deliveries` tag·경로·스키마(`Delivery`, `DeliveryStatus`)를 뺀 뒤 `npm run api:gen`을 실행합니다. 다른 이벤트 스트림에 쓸 `src/shared/realtime/`과 `src/shared/mocks/event-stream.ts`는 남겨 둡니다.
