---
"devc-frontend-generator": patch
---

`dcgen g form`이 `mutation --optimistic`으로 만든 뮤테이션 훅을 인자 없이 불러, 응답 전에 고칠 쿼리가 인자를 받으면 만든 폼이 타입 검사를 통과하지 못하던 문제를 고친다. 이제 폼은 쿼리 모듈에 있는 훅이 받는 인자를 같은 이름과 타입의 props로 받아 훅에 넘긴다. 경로 파라미터와 이름이 같은 인자는 그 props를 함께 넘기고(예: `<AddCartItemForm cartId={cartId} />`가 `useAddCartItemMutation(cartId)`를 부른다), 기본값이 있는 인자(쿼리 파라미터 객체 `params` 등)는 생략할 수 있는 props로 받는다. 생성한 테스트와 스토리는 필수 props에 값을 넘긴다. 이름은 같은데 타입이 다르거나, 테스트가 넘길 값을 정할 수 없는 타입(숫자·문자열·불리언이 아닌)의 필수 인자면 아무 파일도 만들지 않고 이유를 알린다. `dcgen g page --form`도 폼이 훅에 넘기려고 받는 필수 인자를 같은 이름의 동적 세그먼트에서 읽어 넘기고, 그런 세그먼트가 없으면 페이지를 만들지 않는다.
