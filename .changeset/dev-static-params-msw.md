---
"devc-frontend-generator": patch
---

개발 서버(`npm run dev`)에서 `generateStaticParams`가 부르는 API 요청도 MSW가 받는다. Next.js 개발 서버는 `generateStaticParams`를 instrumentation이 돌지 않는 다른 프로세스에서 실행하는데, 서버의 `apiFetch`는 `next build`(목 빌드)에서만 MSW를 켜서 그 요청이 목 백엔드 주소로 그대로 나가 `TypeError: fetch failed`로 실패했다. 그래서 commerce Archetype의 상품 상세(`/shop/products/<id>`)가 개발 서버에서 모두 500으로 열리지 않았고, `npm run g -- page`의 `--mode isr`·`ssg`로 만든 동적 라우트에서 `generateStaticParams`가 API를 부르게 고친 페이지도 같았다. 이제 서버의 `apiFetch`는 `API_MOCKING=enabled`이면 요청을 보내기 전에 그 프로세스에서 MSW를 켠다(프로세스마다 한 번, 서버가 뜰 때 instrumentation이 켠 프로세스에서는 그 결과를 기다리기만 한다). 목 빌드의 경고("API_MOCKING=enabled로 빌드합니다")는 지금처럼 `next build`에서만 남기고, `API_MOCKING`이 `enabled`가 아니면 지금처럼 MSW를 불러오지 않는다.

이미 만든 Starter는 다음처럼 옮긴다.

1. `src/shared/api/api-mocking.ts`의 `startBuildApiMocking`을 새로 만든 Starter의 `startApiMockingIfEnabled`로 바꾼다. 맨 앞의 조건은 `if (process.env.API_MOCKING !== 'enabled' || process.env.VITEST === 'true') return`이 되고, 경고는 `process.env.NEXT_PHASE === 'phase-production-build'`일 때만 남긴다. Vitest에서는 설정 파일(`config/vitest.setup.ts`, 0.1.0으로 만든 Starter는 `vitest.setup.ts`)이 MSW를 켜 두는데, 켜져 있는 MSW를 다시 켜면 MSW가 오류를 던지므로 Vitest에서는 켜지 않는다.
2. `startBuildApiMocking()`을 부르던 곳(`src/shared/api/api-fetch.server.ts`의 `fetchFromServer`, 0.1.0으로 만든 Starter는 `src/shared/api/api-fetch.ts`의 `apiFetch`)이 `startApiMockingIfEnabled()`를 부르게 바꾼다.
3. 개발 서버를 다시 띄워, `generateStaticParams`가 API를 부르는 페이지(commerce Archetype이라면 `/shop/products/1`)가 열리는지 확인한다.
