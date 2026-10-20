## 라우트별 Rendering Mode

`route-rendering` Recipe로 넣었습니다. server Starter에서 라우트마다 고르는 Rendering Mode를 `/rendering` 아래에 데모 페이지 하나씩으로 나란히 보여 줍니다. 데모 페이지는 서버가 그 HTML을 렌더링한 시각을 보여 주므로, 새로고침하며 언제 다시 렌더링하는지 비교할 수 있습니다. 라우트마다 쓸 Rendering Mode를 정했으면 데모(`src/app/rendering/`, `src/features/rendering-demo/`, `e2e/route-rendering.spec.ts`)는 지워도 됩니다.

| 라우트                 | Rendering Mode | 정하는 방법                                                                | 쓰는 곳                                      |
| ---------------------- | -------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| `/rendering/ssr`       | SSR            | `await connection()`(또는 `cookies()`, `headers()`, `searchParams`를 읽음) | 사용자나 요청에 따라 달라지는 화면           |
| `/rendering/ssg`       | SSG            | 요청마다 달라지는 값을 읽지 않음. `dynamic = 'error'`로 지킴               | 배포할 때만 바뀌는 화면                      |
| `/rendering/isr`       | ISR            | `export const revalidate = 10`                                             | 조금 늦게 반영돼도 되는 목록·상세            |
| `/rendering/streaming` | 스트리밍       | SSR 라우트에서 느린 부분만 `<Suspense>`로 감쌈                             | 느린 데이터가 섞인 화면                      |
| `/rendering/csr`       | CSR            | 클라이언트 컴포넌트에서 `useQuery`                                         | 사용자마다 다르고 검색 노출이 필요 없는 화면 |

- 스트리밍과 CSR 데모는 샘플 명세의 상품 목록(`listProducts`)을 씁니다. 스트리밍은 느린 백엔드를 흉내 내려고 2초 기다린 뒤 서버에서 가져와(prefetch) `/products`처럼 hydration으로 넘기고, CSR은 브라우저가 BFF 프록시로 가져옵니다. 샘플 명세를 바꿀 때 두 데모도 함께 지우거나 고칩니다.
- ISR이 다시 렌더링한 HTML은 서버 인스턴스마다 따로 캐시됩니다(Next.js 기본 캐시). 서버를 여러 대 띄우면 인스턴스마다 다른 HTML을 보낼 수 있으므로, 배포 대상을 정할 때 공유 캐시(`next.config.ts`의 `cacheHandler`)도 함께 정합니다.
- `static-export` Starter에는 넣을 수 없습니다. SSR, ISR, 스트리밍은 요청을 받는 Next.js 서버가 있어야 합니다.
- 테스트: `src/features/rendering-demo/browser-product-list.test.tsx`(CSR 목록의 상태), `e2e/route-rendering.spec.ts`(빌드한 앱에서 SSR은 요청마다 렌더링, SSG는 빌드할 때 만든 HTML을 보냄, ISR은 시간이 지나면 다시 렌더링, 스트리밍은 대체 UI를 먼저 보냄, CSR은 브라우저가 BFF 프록시로 요청, 모든 데모 페이지의 접근성).
