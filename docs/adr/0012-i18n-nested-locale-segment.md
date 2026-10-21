# i18n은 번역한 페이지만 중첩한 `[locale]` 세그먼트 아래에 두고, locale은 주소의 params에서만 읽는다

i18n Recipe는 next-intl로 `ko`(기본)와 `en`을 지원한다. 다른 Recipe와 Base는 i18n을 모르고 `src/app/<경로>`에 라우트를 더하며, 모든 Recipe를 켜는 Showcase에서도 그 라우트는 자기 Rendering Mode(SSG, ISR 등)대로 빌드되어야 한다. 그래서 번역한 페이지만 Base의 루트 레이아웃 아래에 중첩한 세그먼트 `src/app/[locale]/`에 두고, 주소 앞에 늘 locale을 붙인다(`localePrefix: 'always'`, `/ko`, `/en/i18n`). locale은 주소의 `[locale]` params에서만 읽는다. 서버 컴포넌트는 `getTranslations({ locale, namespace })`처럼 locale을 직접 넘기고, 앱 전체를 감싼 `I18nProvider`는 `useParams()`로 locale을 정한다. 요청마다 달라지는 값(헤더, 쿠키)을 읽지 않으므로 번역한 페이지는 locale마다 빌드할 때 렌더링하고(`generateStaticParams`), 다른 Recipe 라우트의 Rendering Mode도 그대로다. proxy 처리기(`i18nProxy`)는 홈(`/`)과 locale이 붙은 주소만 다룬다. 홈은 저장한 locale(`NEXT_LOCALE` 쿠키), 브라우저 언어, 기본 locale 순으로 고른 locale의 홈으로 보내고, locale이 붙은 주소에서는 그 locale을 저장하며, 나머지 요청은 손대지 않고 넘긴다. 다른 Recipe와 Base의 `[locale]` 밖 페이지는 옮기지 않고 번역하지 않은 채 둔다. 정적 세그먼트가 동적 세그먼트보다 먼저 맞춰지므로 `/products`, `/rendering` 같은 라우트와 부딪치지 않는다.

## Considered Options

- **next-intl의 기본 구성(모든 라우트를 `app/[locale]/` 아래로)**: `[locale]` 레이아웃이 루트 레이아웃이 되어 `next/root-params`로 locale을 읽고 `<html lang>`도 서버에서 맞게 그린다. 그러나 Recipe가 이렇게 하면 Base와 다른 Recipe의 페이지를 모두 `[locale]` 아래로 옮겨야 하고, i18n을 모르는 다른 Recipe의 overlay가 그 경로를 알 수 없어 Showcase처럼 함께 켤 수 없다.
- **proxy의 rewrite와 요청 헤더·쿠키로 locale을 넘긴다**(next-intl의 "i18n 라우팅 없이" 쿠키로 locale을 정하는 방식 포함): proxy가 `/en/<경로>`를 `/<경로>`로 rewrite하고 locale을 헤더나 쿠키로 넘기면 라우트를 옮기지 않아도 된다. 그러나 앱 전체를 감싸는 Provider나 레이아웃이 요청마다 헤더·쿠키를 읽으므로 모든 페이지가 요청마다 렌더링된다. route-rendering의 SSG 라우트(`dynamic = 'error'`)는 빌드가 실패하고 ISR은 의미를 잃으며, 랜딩 Archetype(SSG)과 proxy가 없는 `static-export`에서도 쓸 수 없다.

## Consequences

- 서버가 그린 HTML의 `<html lang>`은 `en` 페이지에서도 `ko`다. 루트 레이아웃은 `[locale]` 밖이라 locale을 모르기 때문이다. `[locale]` 레이아웃이 페이지 내용을 `<div lang>`으로 감싸 내용의 언어를 알리고, `<html lang>`은 hydration 뒤에 `I18nProvider`가 지금 locale로 바꾼다. JavaScript를 실행하지 않는 크롤러나 보조 기술은 문서 언어를 `ko`로 읽을 수 있다. 기본 locale을 바꾸면 루트 레이아웃의 `lang`도 함께 바꾼다.
- 루트 레이아웃 아래의 `I18nProvider`가 메시지를 넘기므로 모든 locale의 카탈로그가 브라우저 번들에 들어간다. 카탈로그가 커지면 클라이언트 컴포넌트가 쓰는 namespace만 나눈다.
- 서버 컴포넌트는 next-intl에 locale을 직접 넘겨야 한다. 넘기지 않으면 기본 locale로 조용히 그리지 않고 오류가 난다(`src/shared/i18n/request.ts`).
- 다른 Recipe의 페이지는 번역하지 않은 채 기본 locale로 보이고, 거기서 다른 locale을 고르면 그 locale의 홈으로 간다. 번역하려면 페이지를 `src/app/[locale]/` 아래로 옮긴다. Starter가 모든 페이지를 옮기면 next-intl의 기본 구성(`next/root-params`)으로 바꿀 수 있다(Starter README의 "다국어(i18n)").
- `static-export` Starter에는 proxy가 없으므로 홈(`/`)은 Recipe의 `src/app/page.tsx`가 기본 locale의 홈을 그린다. 그래서 i18n은 두 Rendering Mode를 모두 지원한다.
- 검색 엔진에 알리는 locale별 주소는 번역한 페이지의 metadata(`localeAlternates`)가 적는다. 레이아웃은 아래 페이지의 주소를 모르므로 `[locale]` 레이아웃이 한 번에 적을 수 없고, next-intl proxy의 hreflang 응답 헤더는 locale이 없는 주소도 가리키며 `static-export`에서는 쓸 수 없어 끈다. sitemap은 확장 지점 sitemap 규칙으로 `[locale]` 아래 페이지를 locale마다 넣게 한다(ADR-0010).
- `harness/i18n-combinations.test.ts`가 route-rendering과 함께 켠 Starter를 빌드해, 번역한 페이지는 locale마다 미리 렌더링하고 route-rendering의 SSG·ISR·CSR 라우트는 Rendering Mode가 그대로인지 확인한다.
