# 빌드할 때의 API 요청은 목 빌드에서만 MSW가 받고, 목 빌드는 검사에만 쓴다

SSG·ISR 페이지는 `next build`가 미리 렌더링할 때 서버 컴포넌트가 백엔드를 부른다. Next.js는 빌드할 때 instrumentation을 실행하지 않아 Base의 서버 조각(`api-instrumentation.ts`)이 MSW를 켜지 못하므로, 그대로는 이런 페이지가 실제 백엔드 주소 없이 빌드되지 않고 Starter의 GitLab CI `build` 잡도 실패한다. 그래서 `API_MOCKING=enabled`로 실행한 `next build`(목 빌드)에서는 서버의 `apiFetch`가 첫 요청을 보내기 전에 MSW를 켠다(프로세스마다 한 번). 목을 끈 빌드(배포용 빌드, `.env.production`의 기본값)는 서버와 같은 규칙으로 `API_BASE_URL`이 없으면 실패한다. Starter의 CI `build` 잡과 E2E는 목 빌드를 쓰고, 미리 렌더링한 HTML과 Next.js의 데이터 캐시에 목 응답이 담기므로 목 빌드의 결과는 배포하지 않는다. 배포용 빌드는 `API_BASE_URL`을 넣어 따로 만든다(Starter README의 "배포용 빌드와 목 빌드").

## Considered Options

- **하네스·CI가 빌드용 가짜 백엔드를 띄운다**(#12의 하네스): Starter의 CI가 쓸 수 없고, 프로젝트마다 명세와 어긋나는 가짜 서버를 따로 유지해야 한다.
- **CI에 실제 백엔드 주소를 넣는다**: 백엔드가 준비되기 전에는 CI가 돌지 않고(spec #1의 "백엔드에 막히지 않는다"와 어긋난다), 검사 결과가 백엔드의 상태에 따라 바뀐다.
- **`next.config`나 빌드 스크립트에서 MSW를 켠다**: 설정은 빌드의 주 프로세스에서 읽히지만 페이지는 빌드 워커가 렌더링하고, 설정 파일은 앱 코드의 경로 별칭과 생성된 핸들러를 그대로 불러올 수 없다.
- **데이터를 가져오는 SSG·ISR 페이지를 요청할 때 렌더링하도록 바꾼다**: 빌드는 되지만 그 Rendering Mode를 고른 의미가 없어진다.

## Consequences

- `API_MOCKING=enabled`는 "배포하지 않는 빌드와 서버"라는 뜻도 갖는다. 배포할 때만 정해지는 값이 없으면 배포용 빌드는 실패하고 목 빌드는 자리표시 값을 쓴다. Base의 `API_BASE_URL`(`MOCK_API_BASE_URL`)과 seo Recipe의 `NEXT_PUBLIC_SITE_URL`(개발 서버의 주소)이 그렇다. 그래서 GitLab CI와 E2E는 이런 값을 넣지 않아도 된다.
- MSW는 빌드 프로세스 안에서만 돌아 빌드 결과를 띄운 서버에는 남지 않는다. 서버(개발 서버, `next start`)가 뜰 때 MSW를 켜는 곳은 여전히 instrumentation이고, `apiFetch`는 그 결과를 기다리기만 한다. `apiFetch`는 서버에서만 실행되는 블록에서 목 모듈을 동적 import하므로 MSW는 브라우저 번들에 들어가지 않는다.
- 개발 서버도 `generateStaticParams`를 instrumentation이 돌지 않는 다른 프로세스(정적 경로 워커)에서 실행한다. 처음에는 `apiFetch`가 `NEXT_PHASE`가 `phase-production-build`일 때(목 빌드)만 MSW를 켜서, 개발 서버에서 `generateStaticParams`가 보낸 API 요청이 목 백엔드 주소로 그대로 나가 실패했다(#132). 그래서 `apiFetch`는 단계와 상관없이 `API_MOCKING=enabled`이면 그 프로세스에서 MSW를 켜고, 목 빌드의 경고만 `next build`에서 남긴다. Vitest에서는 설정 파일(`config/vitest.setup.ts`)이 MSW를 켜 두므로 `apiFetch`가 다시 켜지 않는다.
- Turbopack이 라우트의 번들에 `msw/node`를 넣으면 MSW가 파일에서 읽는 WebAssembly의 경로가 바뀌어 실패하므로, Base의 `next.config.ts`는 `serverExternalPackages: ['msw']`로 MSW를 `node_modules`에서 불러온다. `standalone` 결과물에는 MSW 패키지가 함께 복사된다.
- 목 빌드의 응답은 Next.js의 데이터 캐시(`.next/cache/fetch-cache`)에도 남으므로, Starter의 CI `build` 잡은 빌드 캐시를 저장하기 전에 그 폴더를 지운다.
- `static-export` Starter의 CI `build` 잡도 목 빌드라 결과(`out/`)를 남기지 않는다. 배포할 `out/`은 배포용 빌드로 만든다.
