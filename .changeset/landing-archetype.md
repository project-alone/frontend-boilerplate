---
'devc-frontend-generator': minor
---

마케팅 랜딩 Archetype(`landing`)을 더한다. `i18n`, `seo` Recipe를 써서 히어로, 주요 기능, 고객 후기, 자주 묻는 질문을 locale마다 콘텐츠 API에서 가져와 빌드할 때 미리 렌더링(SSG)하는 랜딩 페이지(`/ko/landing`, `/en/landing`)를 제공하고, Rendering Mode `server`와 `static-export`를 모두 지원한다. 명세 조각으로 tag `landing`의 콘텐츠 operation `getLandingPage`(`GET /landing-pages/{locale}`, 스키마 `LandingPageContent` 등)를 더하고, Query Domain은 `npm run g -- query`로 만든 코드 그대로다. 콘텐츠는 서버 컴포넌트가 props로 그려 브라우저가 다시 가져오지 않고, 페이지는 콘텐츠의 locale별 제목·설명, canonical, hreflang과 x-default, og:locale, locale별 공유 이미지(`og-image.png`)를 알리며 sitemap에 locale마다 들어간다. 공유 이미지는 `[locale]` 아래에서도 locale마다 미리 만들도록 `seo`의 `ogImage`로 그리는 Route Handler다. 머리글의 랜딩 링크(메시지 카탈로그에 이름을 더한다), locale마다 콘텐츠를 돌려주는 목 백엔드, 컴포넌트 테스트, 스토리, E2E(주요 섹션, 언어 전환, 언어별 메타데이터·공유 이미지, sitemap, 접근성)가 함께 들어간다. `static-export`에서도 쓸 수 있는 Archetype이 생겨 터미널의 `dcgen new`는 `static-export`를 고른 뒤에도 Archetype을 묻는다.
