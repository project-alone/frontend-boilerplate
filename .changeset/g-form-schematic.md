---
"devc-frontend-generator": minor
---

`dcgen g form <operationId> --feature <feature>` Schematic을 더한다. JSON 요청 본문을 입력받는 React Hook Form 폼을 Feature에 만들고, 재생성 계층의 요청 본문 Zod 스키마로 검증해 `mutation` Schematic의 뮤테이션 훅으로 보낸다. 폼의 Storybook 스토리와 컴포넌트 테스트(제출 성공, 검증 실패)도 함께 만든다. Base에는 React Hook Form, `@hookform/resolvers`, `@testing-library/user-event`와 Zod 스키마로 폼을 검증하는 `src/shared/form/form-resolver.ts`를 더한다.
