// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/api/api-fetch.ssr.ts

// apiFetch가 서버에서 불러오는 모듈(package.json의 imports `#api-fetch.server`) 가운데, 서버에서 렌더링하는 클라이언트
// 컴포넌트가 고르는 쪽. 클라이언트 컴포넌트가 import하는 모듈은 브라우저 번들에도 들어가므로 서버 전용 모듈(api-fetch.server.ts)을
// 불러올 수 없고, 이 렌더링에는 요청의 쿠키(로그인 세션)도 없다. 그래서 클라이언트 컴포넌트의 데이터는 서버 컴포넌트가 가져와
// HydrationBoundary로 넘기거나(useSuspenseQuery 등) 브라우저에서 가져온다(useQuery).

/** 서버에서 렌더링하는 클라이언트 컴포넌트가 API를 부르면 어떻게 고치는지 알리며 실패한다. */
export function fetchFromServer(path: string, init: RequestInit): Promise<Response> {
  return Promise.reject(
    new Error(
      `서버에서 렌더링하는 클라이언트 컴포넌트가 API(${init.method ?? 'GET'} ${path})를 불렀습니다. 서버 컴포넌트에서 queryClient.query()로 가져와 HydrationBoundary로 넘기거나, 브라우저에서 가져오는 쿼리 훅(useQuery)을 쓰세요(README의 "서버와 브라우저의 경계").`,
    ),
  )
}
