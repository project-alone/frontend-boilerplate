## 검색 노출(SEO)

`seo` Recipe로 넣었습니다. 검색 엔진과 메신저·SNS의 공유 카드에 보이는 정보(메타데이터, 공유 이미지, `/sitemap.xml`, `/robots.txt`)를 만듭니다.

| 위치                                      | 내용                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/shared/seo/site.ts`                  | 사이트 이름·설명·locale과 사이트 주소(`NEXT_PUBLIC_SITE_URL`)                                        |
| `src/shared/seo/metadata.ts`              | 모든 페이지가 물려받는 메타데이터의 기본값(`siteMetadata`). 루트 레이아웃(`src/app/layout.tsx`)이 씀 |
| `src/shared/seo/og-image.tsx`             | 공유 이미지를 그리는 `ogImage`와 그 글꼴(Pretendard Bold)                                            |
| `src/shared/seo/pretendard-license.txt`   | 글꼴의 저작권 표시와 SIL Open Font License 1.1 전문                                                  |
| `src/shared/seo/next-config.ts`           | 빌드 결과에 글꼴의 라이선스를 함께 담는 next.config 래퍼(`withSeo`, `next.config.plugins.ts`가 씀)   |
| `src/shared/seo/page-routes.ts`           | sitemap에 넣을 페이지를 `src/app`에서 찾는 `findPageRoutes`                                          |
| `src/app/sitemap.ts`, `src/app/robots.ts` | `/sitemap.xml`, `/robots.txt`                                                                        |
| `src/app/sitemap-rules.ts`                | 다른 Recipe가 자기 페이지에 대해 알린 sitemap·robots.txt의 규칙(Generator가 조립)                    |
| `src/app/opengraph-image.tsx`             | 사이트의 기본 공유 이미지. `src/app/products/opengraph-image.tsx`는 페이지별 공유 이미지의 예        |

- **사이트 주소**: `NEXT_PUBLIC_SITE_URL`(예: `https://www.example.com`)로 sitemap, robots.txt, canonical, og:url, 공유 이미지의 절대 주소를 만듭니다. 빌드할 때 코드에 박히므로 배포용 빌드를 만드는 환경에 넣습니다(`.env.example`). 없으면 엉뚱한 주소가 검색 엔진에 알려지지 않도록 빌드가 실패합니다. 개발 서버는 `.env.development`의 `http://localhost:3000`을 쓰고, 배포하지 않는 목 빌드(`API_MOCKING=enabled`. GitLab CI의 `build` 잡과 E2E)는 값이 없으면 같은 주소를 씁니다.

  ```sh
  NEXT_PUBLIC_SITE_URL=https://www.example.com API_BASE_URL=https://<백엔드 주소> npm run build  # 배포용 빌드
  docker build --build-arg NEXT_PUBLIC_SITE_URL=https://www.example.com -t my-app .           # 컨테이너 이미지(docker Recipe)
  ```

- **페이지의 메타데이터**: 루트 레이아웃의 `siteMetadata()`가 모든 페이지의 기본값을 정하므로, 페이지는 `metadata`에 `title`과 `description`만 적습니다.

  ```ts
  export const metadata: Metadata = {
    title: '주문', // <title>주문 | Starter</title>, og:title
    description: '주문 내역과 배송 상태를 확인합니다.', // description, og:description
  }
  ```

  - 제목 뒤에 사이트 이름이 붙고(`주문 | Starter`), 제목을 적지 않은 페이지(홈)는 사이트 이름이 제목입니다. 설명을 적지 않으면 사이트 설명을 씁니다.
  - canonical과 og:url은 페이지마다 그 페이지의 주소(쿼리 문자열 제외)입니다.
  - og:title·og:description과 Twitter 카드(`summary_large_image`)의 제목·설명·이미지는 Next.js가 페이지의 `title`·`description`과 공유 이미지로 채웁니다.
  - Next.js는 레이아웃과 페이지의 metadata를 항목 단위로 덮어씁니다. 페이지가 `openGraph`, `twitter`, `alternates`를 적으면 그 항목의 기본값(og:url, 공유 이미지, canonical)이 사라지므로, 꼭 적어야 하면 `alternates: { canonical: './', ... }`처럼 `siteMetadata()`의 기본값을 함께 적습니다.
  - 검색에 노출하지 않을 페이지(로그인, 내 정보 등)는 `robots: { index: false }`를 적고 `src/app/sitemap.ts`의 `EXCLUDED_ROUTES`에도 적습니다.

- **공유 이미지(OG 이미지)**: 페이지 폴더에 `opengraph-image.tsx`를 두면 그 페이지(와 아래 페이지)의 공유 이미지가 되고, 없으면 가장 가까운 위 폴더의 이미지, 끝내 사이트의 기본 이미지(`src/app/opengraph-image.tsx`)를 씁니다. 새 페이지의 이미지는 `src/app/products/opengraph-image.tsx`를 그 페이지 폴더에 복사해 제목을 바꿉니다.
  - 빌드할 때 한 번 그려 PNG로 둡니다(`dynamic = 'force-static'`). 주소에 확장자가 붙어(`/products/opengraph-image/image.png`) static-export의 정적 파일도 서버가 `image/png`로 응답합니다(`ogImageMetadata`).
  - 모양은 `ogImage`(`src/shared/seo/og-image.tsx`)가 정합니다. next/og는 CSS 변수를 읽지 못하므로 색은 디자인 토큰 파일(`src/shared/ui/tokens.css`)의 값을 읽어 씁니다.
  - 글꼴은 함께 넣은 Pretendard Bold(한글 11,172자, SIL Open Font License 1.1. `src/shared/seo/pretendard-license.txt`)입니다. next/og는 글꼴에 없는 글자를 만나면 빌드 중에 Google Fonts에서 글꼴을 받으므로, 네트워크가 막힌 CI에서도 같은 이미지가 나오도록 글꼴을 함께 둡니다. 한자, 일본어, 이모지는 이 글꼴에 없어 받으러 가므로 공유 이미지의 글에 쓰지 않습니다. 라이선스는 글꼴을 나눠 줄 때 저작권 표시와 라이선스를 함께 담게 하므로, 글꼴 옆에 둔 라이선스 파일(`pretendard-license.txt`)을 지우지 않습니다. server Starter의 빌드 결과(`.next/standalone`, 그것으로 만든 컨테이너 이미지)에도 글꼴이 담기므로 `withSeo`가 라이선스 파일을 함께 담습니다(`outputFileTracingIncludes`). 글꼴을 바꾸면 라이선스 파일과 `next-config.ts`의 경로도 함께 바꿉니다.
- **sitemap**: 빌드할 때 `src/app`의 페이지를 찾아 `/sitemap.xml`에 넣습니다. 다른 Recipe나 `npm run g -- page`가 더한 페이지도 `sitemap.ts`를 고치지 않고 들어갑니다.
  - 경로 그룹(`(admin)`)은 주소에서 빠집니다. 동적 세그먼트가 있는 페이지(`products/[productId]`)는 빌드할 때 주소를 알 수 없어 빠지므로, `sitemap.ts`에서 데이터를 가져와 주소를 더합니다(예: `listProducts`의 상품마다 `/products/<id>`).
  - 다른 Recipe가 더한 페이지의 규칙은 `src/app/sitemap-rules.ts`의 `sitemapRules`에 있습니다(Starter를 만들 때 Generator가 Recipe의 선언을 모아 씀). 규칙이 뺀 주소(`exclude`)와 robots.txt가 막는 주소(`disallow`)는 그 아래 주소까지 sitemap에 넣지 않고, locale을 받는 세그먼트(`locales`) 아래 페이지는 locale마다 넣어 같은 페이지의 locale별 주소를 서로 알리고(`<xhtml:link rel="alternate" hreflang>`), 기본 locale(`defaultValue`)이 있으면 그 주소를 지원하지 않는 언어의 사용자에게 보일 주소(`hreflang="x-default"`)로도 알립니다. 이 프로젝트의 규칙은 `sitemap.ts`의 `EXCLUDED_ROUTES`에 적거나 이 파일을 직접 고칩니다.
  - sitemap에는 다른 주소로 보내지 않고 200으로 응답하는 페이지만 넣습니다(`e2e/seo.spec.ts`가 하나씩 받아 봅니다). 로그인 페이지로 보내는 페이지나 다른 주소로 보내는 페이지는 규칙으로 뺍니다.
  - 빌드할 때 만들어 두므로 페이지를 더하거나 지우면 다시 빌드해야 반영됩니다.
- **robots.txt**: 모든 검색 엔진에 사이트를 열고 sitemap의 주소를 알립니다. 다른 Recipe가 규칙으로 막은 주소(`sitemapRules`의 `disallow`)만 `Disallow`로 막습니다. 로그인해야 들어가는 페이지는 robots.txt에 적지 않고 sitemap에서만 뺍니다(auth Recipe). robots.txt는 누구나 읽으므로 적으면 숨길 주소를 알려 줄 뿐이고, 그런 페이지는 로그인 페이지로 보내며 `noindex`로 검색 결과에서 빠집니다. 스테이징처럼 검색에 노출하지 않을 배포라면 `src/app/robots.ts`의 `rules`를 `{ userAgent: '*', disallow: '/' }`로 바꿉니다.
- Rendering Mode `server`와 `static-export` 모두에서 sitemap.xml, robots.txt, 공유 이미지를 빌드할 때 만듭니다. static-export는 `out/sitemap.xml`, `out/robots.txt`, `out/**/opengraph-image/image.png`로 내보냅니다.
- 사이트 이름, 설명, locale은 `src/shared/seo/site.ts`에서 바꿉니다. 루트 레이아웃의 `<html lang>`과 locale을 맞춥니다.
- `/products` 샘플을 지우면(위 "샘플 명세 바꾸기") `src/app/sitemap.test.ts`와 `e2e/seo.spec.ts`에서 `/products`를 확인하는 부분도 지웁니다.
- 테스트: `src/shared/seo/site.test.ts`(사이트 주소와 없을 때의 실패), `page-routes.test.ts`(sitemap에 넣을 페이지 찾기), `metadata.test.ts`(모든 페이지의 기본값), `og-image.test.tsx`(한글 공유 이미지를 네트워크 없이 그림), `src/app/sitemap.test.ts`(이 Starter의 sitemap과 규칙), `robots.test.ts`(robots.txt), `e2e/seo.spec.ts`(빌드한 앱의 메타데이터, 공유 이미지, sitemap.xml의 페이지가 모두 200으로 응답하는지, robots.txt).
