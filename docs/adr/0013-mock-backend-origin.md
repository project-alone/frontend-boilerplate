# 목 백엔드는 앱과 다른 출처에 두고, MSW 핸들러는 그 주소로 가는 요청만 받는다

MSW 핸들러는 처음에 `*/products`처럼 백엔드 주소를 가리지 않고 경로만 맞췄다. 서버의 MSW(`msw/node`)는 서버가 보내는 요청만 받으므로 문제가 없었지만, `static-export`의 브라우저 MSW(서비스 워커)는 페이지가 보내는 모든 요청을 핸들러에 보인다. 그래서 서비스 워커가 페이지를 맡은 뒤 `/products`나 Recipe의 `/members`를 직접 열거나 새로 고치면 같은 경로의 핸들러가 페이지 탐색 요청에 답해 페이지 대신 목 응답(JSON)이 열렸다(#53). Recipe가 더하는 페이지는 대개 자기 API와 같은 이름을 쓰므로 경로를 피해 짓는 것으로는 막을 수 없다.

그래서 목 백엔드를 앱과 다른 출처 `https://mock.api.test`(`src/shared/api/base-url.ts`의 `MOCK_API_BASE_URL`)에 두고, 명세에서 생성한 핸들러(`orval.config.ts`의 `baseUrl`)와 Recipe가 직접 만든 핸들러가 모두 이 주소로 가는 요청만 받게 한다. MSW가 켜져 있고 백엔드 주소(`API_BASE_URL`, 브라우저는 `NEXT_PUBLIC_API_BASE_URL`)가 없으면 서버와 `static-export`의 브라우저가 이 주소를 부른다. 두 Rendering Mode가 같은 규칙을 쓴다. `.test`는 실제로 쓰이지 않도록 남겨 둔 최상위 도메인(RFC 6761)이라 MSW가 받지 않은 요청은 어디에도 닿지 않고, `https`라서 목 빌드를 `https`로 띄워도 혼합 콘텐츠로 막히지 않는다. 확장 지점 `mockHandlers`의 맨 앞에는 Base의 `pageNavigationHandlers`(order 0)가 페이지 탐색 요청(`request.mode === 'navigate'`)을 목 응답 없이 그대로 보내, 주소를 가리지 않는 핸들러가 목록에 섞여도 페이지가 열리게 한다.

## Considered Options

- **같은 출처의 전용 경로 접두사(예: `/__mock-api`)**: 출처가 같아 CORS를 생각하지 않아도 되지만, 앱의 라우트와 이름 공간을 나눠 쓰므로 Next.js의 라우트(`src/app/__mock-api` 등)나 정적 파일과 겹치지 않는다는 것을 따로 지켜야 하고, `server`에서는 BFF 프록시(`/api/proxy`)와 같은 출처의 경로가 둘이 된다.
- **핸들러는 그대로 두고 페이지 탐색 요청만 거른다**: 고칠 곳은 가장 적지만, 개발 서버에서 Next.js가 클라이언트 탐색 때 페이지와 같은 경로로 보내는 RSC 요청(`/members?_rsc=…`, 페이지 탐색이 아닌 fetch)에는 여전히 목 응답이 간다.
- **샘플 명세의 `servers`(`https://api.example.com`)를 목 주소로 쓴다**: 예전의 기본값이다. 명세의 `servers`는 실제 백엔드를 적는 자리라 프로젝트가 명세를 바꾸면 목 주소도 바뀌고, 실제로 있는 도메인이라 MSW가 받지 않은 요청이 그 도메인으로 나갈 수 있다.

## Consequences

- MSW를 켜 둬도 `API_BASE_URL`(`NEXT_PUBLIC_API_BASE_URL`)을 넣으면 그 백엔드를 부르고 MSW는 그 요청을 받지 않는다. 예전에는 핸들러가 주소를 가리지 않아 실제 백엔드 주소로 가는 요청도 MSW가 받았다.
- Vitest의 브라우저 코드(jsdom)는 `server`에서도 BFF 프록시 대신 목 백엔드를 부른다(`vitest.setup.ts`). 테스트에는 BFF 프록시를 받을 Next.js 서버가 없다.
- `static-export`의 브라우저는 다른 출처를 부르므로, 목 백엔드도 실제 백엔드처럼 CORS를 다룬다(예: file-upload의 업로드 preflight). 서비스 워커가 만든 응답에는 브라우저가 CORS를 검사하지 않지만 Vitest의 jsdom은 검사한다.
- 테스트 하나의 `server.use(...)`는 서비스 워커에 들어가지 않으므로 `*/<경로>`로 써도 된다.
