---
"devc-frontend-generator": minor
---

`seo` Recipe를 더한다. 루트 레이아웃의 `siteMetadata()`가 사이트 주소(`NEXT_PUBLIC_SITE_URL`)를 기준으로 제목 뒤의 사이트 이름, 페이지마다 자기 주소를 알리는 canonical·og:url, Open Graph·Twitter 카드의 기본값을 정해, 페이지는 `title`과 `description`만 적으면 된다. `/sitemap.xml`은 빌드할 때 `src/app`의 페이지를 찾아 만들므로 다른 Recipe나 `dcgen g page`가 더한 페이지도 저절로 들어가고, `/robots.txt`는 sitemap의 주소를 알린다. 공유 이미지는 `next/og`로 빌드할 때 그린다. 사이트의 기본 이미지(`src/app/opengraph-image.tsx`)와 페이지별 이미지의 예(`/products`)를 넣고, 한글을 빌드 중에 네트워크에서 받지 않도록 한글 글꼴(Pretendard Bold, SIL Open Font License)을 함께 둔다. 이미지 주소에 확장자(`opengraph-image/image.png`)를 붙여 Rendering Mode `static-export`의 정적 파일도 `image/png`로 응답한다. 배포용 빌드에 사이트 주소가 없으면 빌드가 실패하고, 배포하지 않는 목 빌드(`API_MOCKING=enabled`)는 개발 서버의 주소를 쓴다. Rendering Mode `server`와 `static-export`를 모두 지원한다.
