---
"devc-frontend-generator": patch
---

commerce Archetype의 상품·주문·결제 페이지와 dashboard Archetype의 사용자 수정 페이지가 백엔드의 404를 `isApiError(error, 404)`로 판단한다. 다른 코드와 같은 방법으로 API 오류를 확인하도록 맞춘 것이고, 화면의 동작은 달라지지 않는다. 이미 만든 Starter는 옮기지 않아도 된다.
