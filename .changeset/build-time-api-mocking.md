---
"devc-frontend-generator": minor
---

목 빌드를 더한다. `API_MOCKING=enabled`로 `next build`하면 빌드할 때 서버 컴포넌트가 보내는 API 요청에도 MSW가 응답해, 데이터를 가져오는 SSG·ISR 페이지(`dcgen g page --mode ssg --query …`)가 실제 백엔드 없이 빌드된다. Next.js는 빌드할 때 instrumentation을 실행하지 않으므로 서버의 `apiFetch`가 첫 요청 전에 MSW를 켜고(`src/shared/api/api-mocking.ts`), 목 빌드라는 경고를 빌드 출력에 남긴다. 배포용 빌드는 `.env.production`의 `API_MOCKING=disabled`대로 MSW를 끄고, 빌드할 때 데이터를 가져오는 페이지가 있는데 `API_BASE_URL`이 없으면 무엇을 넣어야 하는지 알리며 실패한다. Starter의 GitLab CI `build` 잡은 목 빌드로 돌고(static-export는 결과를 남기지 않는다), README는 배포용 빌드 방법과 목 빌드를 배포하지 말라는 경고를 담는다. 서버의 MSW는 번들에 넣지 않고 `node_modules`에서 불러오도록 `next.config.ts`에 `serverExternalPackages: ['msw']`를 더했다.
