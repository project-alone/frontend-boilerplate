---
"devc-frontend-generator": minor
---

`dcgen g page <route>` Schematic을 더한다. `src/app/<route>`에 메타데이터를 담은 페이지와 로딩 상태(`loading.tsx`), 오류 상태(`error.tsx`)를 만들고, `--mode`로 라우트의 Rendering Mode(SSR, SSG, ISR, 스트리밍, CSR)를 고른다. 기본은 server Starter에서 SSR, static-export Starter에서 CSR이고, static-export Starter는 서버가 필요한 모드와 동적 세그먼트 라우트를 거부한다. `--query <operationId>`는 `query` Schematic의 queryOptions로 데이터를 가져와(서버에서 렌더링하는 모드는 서버에서 prefetch해 hydration으로 넘기고, CSR은 브라우저가 가져온다) `--feature`에 만드는 컴포넌트와 그 테스트로 보여 주고, 경로 파라미터는 같은 이름의 동적 세그먼트(`[productId]`)에서 넘긴다. `--form <operationId>`는 `form` Schematic이 만든 폼을 넣는다. 앞선 Schematic의 코드가 없으면 먼저 실행할 명령을 알리고 아무 파일도 만들지 않는다.
