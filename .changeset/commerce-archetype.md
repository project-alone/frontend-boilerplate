---
'devc-frontend-generator': minor
---

커머스 Archetype(`commerce`, `server`)을 더한다. `optimistic-update`와 `multi-step-form` Recipe를 써서 상품 목록·상세(ISR, 목록 5분·상세 1분), 로그인 없이 쓰는 장바구니(백엔드가 만든 장바구니 id를 브라우저에 두는 손님 장바구니, 담기·수량 변경·빼기의 낙관적 업데이트와 실패 시 되돌리기), 배송 정보 → 결제 수단 → 주문 확인의 다단계 주문서, PG 연동 없는 가짜 결제 단계(테스트 결제창)와 주문 완료 화면을 `/shop` 아래에 제공한다. 쓰는 Recipe는 `static-export`도 지원하지만 ISR 화면 때문에 `archetype.json`에서 `server`로 좁힌다. 명세 조각으로 tag `catalog`, `cart`, `orders`의 operation(`listCatalogProducts`, `getCatalogProduct`, `createCart`, `getCart`, `addCartItem`, `updateCartItem`, `removeCartItem`, `placeOrder`, `getOrder`, `confirmOrderPayment`)을 더하고, Query Domain은 `npm run g`로 만든 코드에 응답 전에 보일 장바구니만 채웠다. 장바구니와 주문을 기억하고 재고를 확인하는(재고 2개인 상품은 세 개째에 409) 목 백엔드, 원화(`Intl.NumberFormat`의 KRW) 가격, 컴포넌트 테스트, 스토리, E2E(상품 탐색 → 장바구니 → 주문서 → 가짜 결제 → 주문 완료, 거절된 장바구니 변경의 되돌리기, 접근성)가 함께 들어간다.
