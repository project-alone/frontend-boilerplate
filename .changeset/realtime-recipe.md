---
"devc-frontend-generator": minor
---

`realtime` Recipe를 더한다. 백엔드가 Server-Sent Events로 보내는 이벤트로 TanStack Query의 캐시를 고치는 실시간 배송 현황(`/realtime`)과, 다른 이벤트 스트림에도 쓰는 `src/shared/realtime`(이벤트 스트림 클라이언트 `connectEventStream`, `useEventStream` 훅, 연결 상태 표시 `ConnectionStatus`)을 넣는다. 이벤트는 목록을 다시 요청하지 않고 `setQueryData`로 캐시의 배송만 고치고, 연결될 때마다(끊긴 뒤 다시 연결 포함) Query Domain을 무효화해 놓친 변경을 맞춘다. 끊기면 지수 백오프로 기다렸다가 다시 연결하고 `Last-Event-ID`를 보낸다. SSE는 보통의 HTTP 응답이라 `server`에서는 BFF 프록시를 거쳐, `static-export`에서는 백엔드 주소로 직접 연결하므로 두 Rendering Mode를 모두 지원한다. 명세 조각은 `deliveries` tag의 `listDeliveries`와 `streamDeliveryEvents`이고, MSW의 목 백엔드(`src/shared/mocks/deliveries.ts`)가 이벤트를 흉내 낸다.
