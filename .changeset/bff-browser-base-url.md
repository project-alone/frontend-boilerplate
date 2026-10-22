---
"devc-frontend-generator": minor
---

Rendering Mode `server`의 브라우저는 이제 늘 BFF 프록시(`/api/proxy`)를 거쳐 API를 부른다. 지금까지는 `NEXT_PUBLIC_API_BASE_URL`을 넣고 빌드하면 브라우저가 BFF를 건너뛰고 그 백엔드를 직접 불러, `auth` Recipe와 함께 쓰면 BFF가 붙이는 토큰 없이 나가 401을 받았다. 이 변수는 BFF 프록시가 없는 `static-export`만 쓰므로 `server` Starter의 `.env.example`과 `process-env.d.ts`, docker Recipe의 `Dockerfile`(`ARG`)과 README에서 뺐다. 설정 하나를 빼는 깨지는 변경이다. Vitest에서는 Vitest가 넣는 `VITEST=true`를 보고 브라우저 코드의 요청을 지금처럼 목 백엔드로 보낸다. `static-export` Starter는 달라지지 않으므로 옮길 것이 없다.

이미 만든 `server` Starter는 다음처럼 옮긴다.

1. `src/shared/api/base-url.ts`의 `browserBaseUrl()`이 `process.env.VITEST === 'true' ? MOCK_API_BASE_URL : BFF_PROXY_PATH`를 돌려주게 바꾼다.
2. `process-env.d.ts`에서 `NEXT_PUBLIC_API_BASE_URL`을 빼고 `readonly VITEST?: string`을 더한다. `.env.example`에서도 `NEXT_PUBLIC_API_BASE_URL`과 그 주석을 뺀다.
3. `vitest.setup.ts`에서 `Object.assign(process.env, { NEXT_PUBLIC_API_BASE_URL: MOCK_API_BASE_URL })`과 그 주석을 지운다.
4. 테스트에서 BFF 프록시로 가는 요청을 보려고 `vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')`을 쓰던 곳은 `vi.stubEnv('VITEST', undefined)`로 바꾼다(`src/shared/api/api-fetch.test.ts`, `route-rendering` Recipe의 `src/features/rendering-demo/browser-product-list.test.tsx`).
5. docker Recipe를 넣었으면 `Dockerfile`의 `ARG NEXT_PUBLIC_API_BASE_URL`과 그 주석, README의 "빌드 인자와 환경 변수" 표에서 그 줄을 지운다. 배포 파이프라인이 `--build-arg NEXT_PUBLIC_API_BASE_URL=…`이나 이 환경 변수를 넘기고 있었다면 뺀다. 브라우저의 요청은 BFF 프록시가 서버의 `API_BASE_URL`로 전달한다.
