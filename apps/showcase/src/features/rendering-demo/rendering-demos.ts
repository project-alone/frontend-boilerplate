// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/route-rendering/src/features/rendering-demo/rendering-demos.ts

/** 라우트별 Rendering Mode 데모. /rendering 목록 페이지와 E2E가 함께 쓴다. */
export const RENDERING_DEMOS = [
  {
    path: '/rendering/ssr',
    name: 'SSR',
    summary: '요청마다 서버에서 렌더링합니다. 요청에 따라 달라지는 화면에 씁니다.',
  },
  {
    path: '/rendering/ssg',
    name: 'SSG',
    summary: '빌드할 때 한 번 렌더링한 HTML을 모든 요청에 보냅니다. 내용이 배포 단위로만 바뀌는 화면에 씁니다.',
  },
  {
    path: '/rendering/isr',
    name: 'ISR',
    summary: '미리 렌더링한 HTML을 보내다가 정한 시간마다 다시 렌더링합니다. 조금 늦게 반영돼도 되는 화면에 씁니다.',
  },
  {
    path: '/rendering/streaming',
    name: '스트리밍',
    summary: '느린 데이터를 기다리지 않고 나머지를 먼저 보낸 뒤, 데이터가 오면 같은 응답에 이어 보냅니다.',
  },
  {
    path: '/rendering/csr',
    name: 'CSR',
    summary:
      '데이터 없는 HTML을 보내고 브라우저가 데이터를 가져와 그립니다. 사용자마다 다르고 검색 노출이 필요 없는 화면에 씁니다.',
  },
] as const
