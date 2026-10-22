# Archetype 작성하기

Archetype은 여러 Recipe를 조합해 만든 완성된 앱 유형이다(GLOSSARY. 예: 관리자 대시보드, 마케팅 랜딩). Recipe가 기능 패턴 하나를 담는다면, Archetype은 그 Recipe들을 쓰는 화면을 담아 Starter를 "관리자 화면 프로젝트" 같은 출발점으로 만든다. Archetype은 Recipe와 같은 overlay 형식([Recipe 작성하기](recipes.md))에 선언 파일 하나(`archetype.json`)를 더한 것이라 새로 익힐 형식이 거의 없다. 이 문서는 Recipe와 다른 점만 적는다. 예시는 첫 Archetype인 `archetypes/dashboard/`이고, 문서 끝에 Rendering Mode를 스스로 좁히는 `archetypes/commerce/`와 두 Rendering Mode에서 쓰는 마케팅 랜딩 `archetypes/landing/`도 적는다.

## Starter를 조립하는 순서

`dcgen new --archetype <이름>`(또는 터미널에서 Rendering Mode 다음에 묻는 Archetype)은 [Recipe의 조립 순서](recipes.md#starter를-조립하는-순서)에 Archetype을 끼운다.

1. Base를 복사하고 Rendering Mode overlay를 덧입힌다.
2. 고른 Recipe, **고른 Archetype이 쓰는 Recipe**, 그 Recipe들이 필요로 하는 Recipe를 덧입힌다. 필요한 Recipe가 먼저 오고 나머지는 이름순이다. Archetype이 쓰는 Recipe를 따로 골랐는지, 고른 순서가 어떤지와 상관없이 같은 Starter가 나온다. 고르지 않았는데 함께 넣은 Recipe는 `Archetype dashboard에 필요한 Recipe auth을(를) 함께 넣습니다.`처럼 알린다.
3. **Recipe를 모두 덧입힌 뒤 Archetype을 이름순으로 덧입힌다.** 그래서 Archetype은 자기가 쓰는 Recipe의 파일 위에 화면을 더하고, Recipe의 파일을 패치로 고칠 수 있다.
4. Base와 모든 overlay(Archetype 포함)의 명세 조각을 병합해 재생성 API 계층을 다시 만들고, 확장 지점의 조각을 모아 조립 파일을 쓴다.

고른 Rendering Mode를 Archetype이나 그 Archetype이 쓰는 Recipe가 지원하지 않으면 아무것도 만들기 전에 이유와 함께 거부한다. 예: `--rendering-mode static-export --archetype dashboard`는 `Archetype dashboard은(는) Rendering Mode static-export에서 쓸 수 없습니다(지원: server).`와 함께 auth Recipe가 왜 `static-export`에서 쓸 수 없는지 알린다. 터미널에서 고를 때는 그런 Archetype을 이유와 함께 보여 주고 고르지 못하게 하며(`static-export`에서는 commerce와 dashboard를 고를 수 없고 landing은 고를 수 있다), 고른 Archetype이 쓰는 Recipe는 Recipe 선택지에서 "Archetype dashboard에 들어 있어 함께 넣습니다"로 보여 준다. 고른 Rendering Mode에서 쓸 수 있는 Archetype이 하나도 없으면 Archetype은 묻지 않고 이유만 알린다.

Archetype은 여러 개를 함께 고를 수 있다(`--archetype`을 여러 번). 모든 Recipe와 Archetype을 켜는 Showcase가 그런 조합이다.

## 디렉터리 구조

Archetype은 `packages/devc-frontend-generator/archetypes/<이름>/` 디렉터리 하나다. 이름은 kebab-case로 짓고 그대로 `dcgen new --archetype <이름>`의 값이 된다. 나머지는 Recipe의 overlay와 같다(파일 더하기, `<경로>.patch`, `package.json`, `README.md` 절, `remove.txt`, `extensions.json`, `openapi.yaml`, dotenv 파일).

```
archetypes/<이름>/
├── archetype.json   선언: 설명, 쓰는 Recipe, (좁힐 때만) 지원하는 Rendering Mode (필수). 화면은 따로 적지 않고 아래 overlay의 파일이 곧 화면이다
├── extensions.json  확장 지점에 더할 조각(예: 머리글의 링크, MSW 핸들러)
├── openapi.yaml     Base 명세에 병합할 명세 조각(Archetype의 화면이 쓰는 operation)
├── README.md        Starter의 README.md에 덧입힐 절
├── <경로>.patch     Starter의 기존 파일(Base나 Recipe의 파일)을 고치는 unified diff
└── <경로>           Archetype의 화면, 테스트, 스토리, E2E
```

### archetype.json

```json
{
  "description": "로그인한 사용자가 통계 차트를 보고, ... 관리자 대시보드(/dashboard)",
  "recipes": ["auth", "chart", "table"]
}
```

| 항목                   | 필수 | 뜻                                                                                                                                                                         |
| ---------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description`          | 예   | 한 줄 설명. `dcgen new`의 대화형 선택지에 쓰는 Recipe와 함께 보인다.                                                                                                       |
| `recipes`              | 예   | Archetype의 화면이 쓰는 Recipe의 이름(하나 이상). 사용자가 고르지 않았으면 Generator가 알리고 함께 넣는다. 그 Recipe의 `requires`도 함께 들어간다.                         |
| `renderingModes`       |      | 이 Archetype을 쓸 수 있는 Rendering Mode. 적지 않으면 `recipes`(와 그 `requires`)가 모두 지원하는 Rendering Mode다. 적으면 그 가운데 일부로 좁힌다(더 넓히면 선언 오류다). |
| `renderingModesReason` |      | `renderingModes`를 좁혔을 때, 빠진 Rendering Mode에서 쓸 수 없는 이유. 조합을 거부할 때 보여 준다.                                                                         |

Rendering Mode는 대개 쓰는 Recipe가 정한다. 대시보드는 `server`만 지원하는 `auth`를 쓰므로 적지 않아도 `server`만 지원하고, 랜딩은 두 Rendering Mode를 모두 지원하는 `i18n`과 `seo`를 쓰고 화면이 빌드할 때 미리 렌더링하는 페이지뿐이라 적지 않고 둘 다 지원한다. 쓰는 Recipe가 모두 `static-export`를 지원해도 Archetype의 화면이 요청을 받는 서버를 요구하면(예: 커머스의 ISR로 다시 만드는 상품 목록·상세) `renderingModes: ["server"]`와 `renderingModesReason`을 적는다. `harness/archetypes.test.ts`가 시험용 Archetype(`harness/fixtures/archetypes/server-only-archetype-fixture`)으로 이 경우를 검증한다.

## Archetype이 지키는 것

모든 Recipe와 Archetype을 함께 켜는 Showcase에서도 다른 Recipe와 Archetype을 깨뜨리지 않아야 한다.

- **라우트는 자기 경로 아래에 둔다.** 대시보드는 `/dashboard` 아래에만 화면을 둔다. 홈(`/`)이나 다른 Recipe의 라우트, 다른 Recipe의 파일을 통째로 대신하면 Showcase에서 그 Recipe가 깨진다(예: i18n은 홈을 대신한다). 번역한 화면은 i18n Recipe의 `[locale]` 세그먼트 아래 자기 경로에 둔다(랜딩의 `src/app/[locale]/landing/`, ADR-0012). 다른 화면에서 들어오는 길은 확장 지점 `header`의 링크로 낸다(대시보드의 `DashboardLink`, 커머스의 `ShopLink`, 랜딩의 `LandingLink`). 경로 안의 이동은 그 경로의 `layout.tsx`에 둔다.
- **Recipe의 파일은 패치로 조금만 고친다.** Archetype은 Recipe 뒤에 덧입히므로 Recipe의 파일을 `<경로>.patch`로 고칠 수 있다. 대시보드는 auth Recipe의 접근 규칙(`src/shared/auth/access-rules.ts`의 `PROTECTED_ROUTES`)에 자기 라우트의 규칙을 더하고(`archetypes/dashboard/src/shared/auth/access-rules.ts.patch`), 랜딩은 i18n Recipe의 메시지 카탈로그(`src/shared/i18n/ko.json`, `en.json`)에 머리글 링크의 메시지(`LandingLink`)를 더한다. 맥락 줄은 꼭 필요한 만큼만 둔다. 같은 자리를 고치는 Archetype이나 Recipe가 둘이 되면 그 자리를 확장 지점으로 바꾼다(ADR-0010). Recipe가 Archetype에 필요한 일반적인 기능이 없으면 Recipe를 고친다(대시보드를 만들며 auth의 접근 규칙이 `[userId]` 같은 동적 세그먼트를 받게 했다).
- **명세의 이름이 겹치지 않게 한다.** 명세 조각의 경로, 스키마 이름, tag, operationId가 Base나 다른 overlay와 겹치면 생성이 실패한다. 쓰는 Recipe의 스키마는 `$ref`로 그대로 쓴다(대시보드의 사용자 역할은 auth의 `Role`). 이름이 겹치는 개념은 다른 이름을 쓴다(auth에 로그인한 사용자 `User`가 있어 대시보드가 관리하는 사용자는 `UserAccount`). 스키마 이름은 Archetype이 다루는 개념을 드러내 짓고(커머스의 `Cart`, `Order`, 대시보드의 `UserAccount`), 다른 overlay도 쓸 만한 흔한 이름이면 Archetype의 이름으로 시작한다(랜딩의 `LandingHero`, `LandingFaq`). Showcase가 모든 Recipe와 Archetype을 함께 켜므로 겹친 이름은 CI에서 드러난다.
- **코드는 Schematic이 만드는 모양을 따른다.** Query Domain은 `npm run g -- query`·`mutation`이 만든 코드 그대로 두고, 하네스가 지우고 다시 만들어 같은지 본다. 폼과 페이지는 `form`·`page` Schematic이 만든 코드에서 시작해 화면에 맞게 고친다. import 방향과 폴더 깊이(ADR-0005), 디자인 토큰, 주석과 문서의 언어는 [Recipe의 코드 규칙](recipes.md#코드-규칙)과 같다.
- **목 백엔드는 확장 지점 `mockHandlers`로 더한다.** 화면이 데이터를 추가하고 고치는 흐름(E2E)을 보려면 생성된 MSW 핸들러(늘 같은 example) 대신 상태를 기억하는 핸들러를 둔다(대시보드의 `src/shared/mocks/users.ts`). Recipe의 핸들러처럼 목 백엔드 주소(`MOCK_API_BASE_URL`)로 가는 요청만 받게 쓴다([MSW 핸들러](recipes.md#msw-핸들러mockhandlers), ADR-0013). 로그인해야 쓰는 operation은 실제 백엔드처럼 accessToken으로 로그인과 역할을 확인해 401·403으로 거절한다. 토큰은 auth Recipe의 목 백엔드가 발급하므로 따로 만들지 않고, 요청한 사용자는 `mockUserOf(request)`로 알아낸다(대시보드는 목록·통계·상세는 로그인한 사용자 모두, 추가·수정은 관리자만). 로그인하는 계정의 정보(이름, 이메일, 역할)를 더하고 고치는 핸들러도 사본을 두지 않고 auth의 목 백엔드가 가진 사용자 저장소를 읽고 고친다(`mockUsers()`, `saveMockUser(user)`, `resetMockUsers(seed)`). 실제 백엔드는 사용자 테이블 하나를 함께 쓰므로, 사본을 두면 화면에서 바꾼 역할이 로그인에 반영되지 않는다(#66). 대시보드는 이름·이메일·역할을 그 저장소에 두고 상태·부서·추가한 날만 따로 기억하며, 처음 사용자도 그 저장소에 넣는다. Recipe는 Archetype에 의존하지 않으므로 저장소는 auth가 갖고 Archetype이 그것을 쓴다. 화면의 접근 규칙과 별개로 백엔드도 거절해야 화면을 거치지 않은 요청까지 막는다는 것을 Starter의 테스트가 보여 준다. Vitest의 컴포넌트 테스트는 BFF 프록시가 없으므로 auth의 `signInAsMockUser`로 누구로 로그인했는지 정한다. E2E 대상 서버는 테스트 사이에 상태가 남으므로 E2E는 새 이름·이메일로 데이터를 만들고, 다른 테스트가 만든 데이터가 있어도 통과하게 쓴다.

## 테스트

Recipe처럼 Archetype도 자기 테스트(단위·컴포넌트 테스트, 스토리, `e2e/*.spec.ts`)를 Starter에 넣고, 하네스에 Archetype마다 조합 매트릭스 테스트를 둔다. `useStarter({ prefix: 'dcgen-<이름>-', renderingMode, archetypes: ['<이름>'], install: true, playwright: true })`로 지원하는 Rendering Mode마다 Starter를 만들고 Starter의 스크립트를 실행한다(`harness/dashboard.test.ts`, `harness/commerce.test.ts`, 두 Rendering Mode의 `harness/landing.test.ts`). 지원하지 않는 Rendering Mode의 거부도 그 파일에서 본다. 빌드할 때 데이터를 가져오는 화면(SSG·ISR)이 있으면 Starter의 GitLab CI처럼 목 빌드(`API_MOCKING=enabled`)로 빌드하고, 배포용 빌드는 백엔드 주소(`API_BASE_URL`) 없이 실패하는지 본다(ADR-0011). Archetype을 고르고 조합을 검사하는 Generator의 동작은 `harness/archetypes.test.ts`가 본다.

## Showcase

Showcase는 Base에 Rendering Mode `server`와 Generator에 담긴 모든 Recipe, 모든 Archetype을 덧입힌 Starter다(ADR-0002, [Recipe 작성하기의 Showcase](recipes.md#showcase)). 그래서 Archetype은 `server`를 지원해야 하고, Archetype을 더하거나 고치면 `npm run showcase`로 다시 만들어 함께 커밋한다. 생성 안내는 Archetype의 파일과 패치도 원본으로 알린다(예: `recipes/auth/src/shared/auth/access-rules.ts, archetypes/dashboard/src/shared/auth/access-rules.ts.patch`). `harness/showcase-starter.test.ts`가 모든 Recipe·Archetype을 켠 Showcase의 스크립트와 E2E를 함께 돌려 부딪치는지 본다.

Archetype을 더하거나 고친 PR에도 changeset(`npm run changeset`)을 함께 커밋한다.

## 예: dashboard

로그인한 사용자가 사용자 통계와 차트를 보고, 정렬·필터가 되는 사용자 목록을 보며, 관리자는 사용자를 추가하고 고치는 관리자 대시보드다(`/dashboard`). 쓰는 Recipe가 `server`만 지원하는 `auth`를 포함하므로 `server`에서만 쓸 수 있다.

| 선언하는 것    | `archetypes/dashboard/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 쓰는 Recipe    | `auth`(로그인, 보호된 라우트와 역할), `chart`(차트 틀 `ChartFigure`와 서비스 지표 차트), `table`(정렬·필터 테이블의 패턴)                                                                                                                                                                                                                                                                                                                                                                      |
| 화면           | `src/app/dashboard/`(개요, 사용자 목록, 사용자 추가 `users/new`, 사용자 수정 `users/[userId]/edit`, 레이아웃의 대시보드 안 이동, 로딩·오류·찾을 수 없음)                                                                                                                                                                                                                                                                                                                                       |
| 추가 파일      | `src/features/user-stats/`, `user-table/`, `user-form/`, `dashboard-nav/`, `src/queries/users/`(Schematic이 만든 그대로), `src/shared/dashboard/`(라우트와 역할 확인, 역할·상태 이름), `src/shared/mocks/users.ts`(로그인과 역할을 확인하고, 사용자의 이름·이메일·역할은 auth의 사용자 저장소에 두는 목 백엔드)                                                                                                                                                                                |
| 확장 지점      | `openapi.yaml`(명세 조각): tag `users`의 `listUsers`, `createUser`, `getUserStats`, `getUser`, `updateUser`, 스키마 `UserAccount`, `UserStatus` 등. `extensions.json`: 머리글 `DashboardLink`(50, 맨 앞), MSW 핸들러 `usersHandlers`(100)                                                                                                                                                                                                                                                      |
| 설정 패치      | `src/shared/auth/access-rules.ts.patch`(auth Recipe의 `PROTECTED_ROUTES`에 대시보드 규칙: `/dashboard`는 로그인, 추가·수정은 `admin`. seo처럼 sitemap을 만드는 Recipe와 함께 넣으면 auth의 sitemap 규칙이 이 경로도 sitemap에서 뺀다. 레이아웃의 metadata는 `noindex`)                                                                                                                                                                                                                         |
| npm 의존성     | 없음(쓰는 Recipe의 의존성을 쓴다)                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 자기 테스트    | `users.test.ts`(목 백엔드의 401·403, 역할을 바꾼 계정의 다시 로그인), `user-stats-overview.test.tsx`, `user-table.test.tsx`, `create-user-form.test.tsx`, `update-user-form.test.tsx`(401·403이면 알리고 접근 규칙을 다시 확인), `dashboard-routes.test.ts`, 폼과 차트의 스토리, `e2e/dashboard.spec.ts`(로그인 → 통계 확인 → 사용자 추가 → 목록과 통계에 반영 → 수정, 역할, BFF 프록시로 바로 보낸 요청의 401·403, 폼을 연 뒤 바뀐 세션, 역할을 바꾼 계정이 다시 로그인하면 바뀐 역할로 동작) |
| Rendering Mode | `server`(auth에서 정해진다)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## 예: commerce

상품 목록·상세(ISR), 로그인 없이 쓰는 장바구니(낙관적 업데이트), 다단계 주문서, PG 연동 없는 가짜 결제 단계, 주문 완료 화면을 갖춘 쇼핑몰이다(`/shop`). 쓰는 Recipe(`optimistic-update`, `multi-step-form`)는 두 Rendering Mode를 모두 지원하지만, 상품 목록과 상세를 정한 시간마다 다시 렌더링(ISR)하려면 요청을 받는 Next.js 서버가 있어야 하므로 `archetype.json`에 `renderingModes: ["server"]`와 그 이유를 적어 스스로 좁힌다.

- **장바구니는 손님 장바구니다.** spec(#1)이 장바구니에 로그인을 요구하지 않고 auth Recipe는 `server`만 지원하므로, 장바구니를 로그인 세션에 묶지 않는다. 처음 담을 때 백엔드가 장바구니를 만들어(`createCart`) 추측할 수 없는 id를 주고, 앱은 그 id만 브라우저의 localStorage에 둔다(`src/shared/shop/cart-id.ts`). 담긴 상품과 가격은 백엔드가 들고 있어 프론트엔드에는 DB가 없고(ADR-0006의 제약), 서버 컴포넌트가 쿠키를 읽지 않으므로 상품 목록·상세가 요청마다 렌더링되지 않는다. 로그인한 사용자의 장바구니는 백엔드가 accessToken으로 찾게 하면 되고(auth Recipe의 BFF 프록시가 토큰을 붙인다), 손님 장바구니를 합치는 일도 백엔드가 맡는다.
- **ISR과 목 빌드.** 상품 목록은 `revalidate = 300`, 상세는 `revalidate = 60`이고 상세는 `generateStaticParams`로 빌드할 때 모든 상품을 렌더링한다. 빌드할 때 백엔드를 부르므로 목 빌드(`API_MOCKING=enabled`)에서는 MSW가 받고, 배포용 빌드는 `API_BASE_URL`이 있어야 한다(ADR-0011). 늦을 수 있는 가격과 재고는 장바구니에 담을 때와 주문할 때 백엔드가 다시 확인한다(409).
- **낙관적 업데이트.** 장바구니의 Query Domain은 `mutation <operationId> --optimistic getCart`가 만든 뼈대에 응답 전에 보일 장바구니를 만드는 `apply<OperationId>`만 채운 것이다. 처음 담는 상품은 장바구니의 id를 백엔드가 정해야 해서 응답을 기다린다. 실패는 목 백엔드가 늘 같은 상품(재고 2개인 한정판 머그)으로 재현해 개발 서버와 E2E가 테스트만의 코드 없이 되돌리기를 본다(optimistic-update Recipe와 같은 방식).
- **가짜 결제.** 주문서는 multi-step-form Recipe의 `useFormSteps`·`StepForm`과 Base의 `useSchemaForm`으로 만든 단계(배송 정보 → 결제 수단 → 주문 확인)이고, 주문하면 결제 대기 주문의 테스트 결제창(`/shop/orders/[orderId]/payment`)으로 간다. 승인하면 PG가 돌려줄 결제 키 대신 `fake-<주문 번호>`와 결제 금액으로 `confirmOrderPayment`를 부른다. 실제 PG를 연동하면 이 자리에서 PG의 결제창을 열고, 승인과 금액 확인은 백엔드가 한다.

| 선언하는 것    | `archetypes/commerce/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 쓰는 Recipe    | `optimistic-update`(낙관적 업데이트와 되돌리기, 알림), `multi-step-form`(단계별 검증과 상태 유지의 부품 `src/shared/multi-step-form/`)                                                                                                                                                                                                                                                                                                                                                                                                 |
| 화면           | `src/app/shop/`(상품 목록 ISR, 상품 상세 `products/[productId]` ISR, 장바구니 `cart`, 주문서 `checkout`, 가짜 결제 `orders/[orderId]/payment`, 주문 완료 `orders/[orderId]`, 레이아웃의 쇼핑몰 안 이동, 로딩·오류·찾을 수 없음)                                                                                                                                                                                                                                                                                                        |
| 추가 파일      | `src/features/shop-nav/`, `shop-catalog/`, `shop-cart/`, `shop-checkout/`, `src/queries/catalog/`, `cart/`, `orders/`(Schematic이 만든 코드에 `apply<OperationId>`만 채움), `src/shared/shop/`(라우트와 sitemap 규칙, 원화 가격, 장바구니 id, 결제 수단 이름, 실패 이유), `src/shared/mocks/shop.ts`(장바구니·주문을 기억하고 재고를 확인하는 목 백엔드)                                                                                                                                                                               |
| 확장 지점      | `openapi.yaml`(명세 조각): tag `catalog`의 `listCatalogProducts`, `getCatalogProduct`, tag `cart`의 `createCart`, `getCart`, `addCartItem`, `updateCartItem`, `removeCartItem`, tag `orders`의 `placeOrder`, `getOrder`, `confirmOrderPayment`, 스키마 `CatalogProduct`, `Cart`, `CartItem`, `NewCartItem`, `CartItemUpdate`, `NewOrder`, `Order`, `OrderItem`, `OrderPayment`, `OrderStatus`, `PaymentMethod`, `ShopError`. `extensions.json`: 머리글 `ShopLink`(60), MSW 핸들러 `shopHandlers`(100), sitemap 규칙 `shopSitemapRules` |
| 설정 패치      | 없음                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| npm 의존성     | 없음(Base와 쓰는 Recipe의 의존성을 쓴다)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 자기 테스트    | `shop.test.ts`(목 백엔드의 합계, 재고 부족, 주문과 결제), `cart-id.test.ts`, `catalog-product-list.test.tsx`, `shop-nav.test.tsx`, `add-to-cart-form.test.tsx`·`cart-view.test.tsx`(응답 전에 바뀌는 장바구니와 되돌리기), `checkout-form.test.tsx`, `fake-payment.test.tsx`, 주문서의 스토리, `e2e/commerce.spec.ts`(ISR로 미리 렌더링한 목록·상세, 상품 탐색 → 장바구니 → 주문서 → 가짜 결제 → 주문 완료, 거절된 장바구니 변경의 되돌리기, 접근성)                                                                                   |
| Rendering Mode | `server`(`archetype.json`의 `renderingModes`로 좁힘. ISR)                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## 예: landing

히어로, 주요 기능, 고객 후기, 자주 묻는 질문을 locale마다 콘텐츠 API에서 가져와 빌드할 때 미리 렌더링(SSG)하는 마케팅 랜딩 페이지다(`/ko/landing`, `/en/landing`). 쓰는 Recipe(`i18n`, `seo`)가 두 Rendering Mode를 모두 지원하고 화면이 빌드할 때 미리 렌더링하는 페이지와 공유 이미지뿐이라, `static-export` Starter에서도 쓴다. 그때는 페이지와 공유 이미지가 `out/`의 정적 파일이 된다.

- **콘텐츠는 명세의 operation 하나다.** 헤드리스 CMS처럼 페이지의 문구(검색 결과에 보일 제목·설명, 섹션마다의 문구)를 백엔드가 locale마다 돌려준다(`GET /landing-pages/{locale}`, `getLandingPage`). locale을 경로 파라미터로 받아, 페이지는 `[locale]` params를 그대로 넘긴다. 메시지 카탈로그에는 머리글 링크의 이름만 더한다.
- **콘텐츠는 hydration으로 넘기지 않는다.** 서버 컴포넌트가 Query Domain의 queryOptions로 콘텐츠를 가져와(`queryClient.query`, ADR-0008) 화면(서버 컴포넌트)에 props로 넘긴다. 한 페이지를 렌더링하는 동안 metadata와 화면은 React의 `cache`로 한 번만 가져온다. Base의 `/products`처럼 브라우저의 쿼리 캐시에 넘기면 `staleTime`이 지난 콘텐츠(빌드한 지 오래된 정적 페이지는 처음부터 그렇다)를 브라우저가 다시 가져와, 배포한 정적 페이지가 방문마다 백엔드를 부른다. E2E가 브라우저가 콘텐츠 API를 부르지 않는 것을 확인한다. 콘텐츠를 바꾸면 다시 빌드한다.
- **공유 이미지는 Route Handler로 만든다.** seo Recipe처럼 페이지 폴더에 `opengraph-image.tsx`를 두면, Next.js(16.4)가 그 이미지 라우트에는 위 `[locale]` 레이아웃의 `generateStaticParams`를 쓰지 않아 locale마다 미리 만들지 못한다(`server`는 요청이 올 때 백엔드를 불러 그리고, `static-export`는 빌드가 실패한다). seo처럼 `generateImageMetadata`를 쓰는 이미지 라우트는 Next.js가 `generateStaticParams`를 이미지 id로 직접 만들어, `opengraph-image.tsx`가 locale을 더할 자리도 없다. 그래서 `src/app/[locale]/landing/og-image.png/route.tsx`가 locale을 스스로 정하고(`generateStaticParams`) seo의 `ogImage`로 그리며, 페이지의 metadata가 위 레이아웃의 OpenGraph를 그대로 둔 채 이 주소를 공유 이미지로 알린다. Twitter 카드의 이미지는 Next.js가 같은 이미지로 채운다. `[locale]` 아래의 다른 번역 페이지에 공유 이미지를 따로 줄 때도 같은 방법을 쓴다.
- **sitemap은 따로 선언하지 않는다.** i18n Recipe의 sitemap 규칙(`locales`)이 `[locale]` 아래 페이지를 locale마다 넣고 서로를 언어별 주소와 x-default로 묶는다. `locales`는 한 Recipe만 적으므로 Archetype은 같은 규칙을 다시 적지 않는다.

| 선언하는 것    | `archetypes/landing/`                                                                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 쓰는 Recipe    | `i18n`(locale이 붙은 주소, 언어 전환, og:locale·hreflang·x-default, sitemap의 locale별 주소), `seo`(사이트 주소, canonical, 공유 이미지를 그리는 `ogImage`, sitemap)                                                                                             |
| 화면           | `src/app/[locale]/landing/`(페이지, locale별 공유 이미지 `og-image.png`)                                                                                                                                                                                         |
| 추가 파일      | `src/features/landing/`(화면, 서버에서 콘텐츠 가져오기, 머리글 링크), `src/queries/landing/`(Schematic이 만든 그대로), `src/shared/mocks/landing.ts`(locale마다 콘텐츠를 돌려주는 목 백엔드)                                                                     |
| 확장 지점      | `openapi.yaml`(명세 조각): tag `landing`의 `getLandingPage`, 스키마 `LandingPageContent`, `LandingHero`, `LandingCallToAction`, `LandingFeatureSection` 등. `extensions.json`: 머리글 `LandingLink`(40, 대시보드 링크보다 앞), MSW 핸들러 `landingHandlers`(100) |
| 설정 패치      | `src/shared/i18n/ko.json.patch`, `en.json.patch`(i18n Recipe의 메시지 카탈로그에 머리글 링크의 이름 `LandingLink`)                                                                                                                                               |
| npm 의존성     | 없음(쓰는 Recipe의 의존성을 쓴다)                                                                                                                                                                                                                                |
| 자기 테스트    | `landing.test.ts`(locale마다 다른 콘텐츠, 없는 locale의 404), `landing.test.tsx`(섹션 랜드마크, 자주 묻는 질문), `landing.stories.tsx`, `e2e/landing.spec.ts`(주요 섹션, 언어 전환, 언어별 메타데이터·공유 이미지, sitemap, 접근성)                              |
| Rendering Mode | `server`, `static-export`(i18n, seo에서 정해진다)                                                                                                                                                                                                                |
