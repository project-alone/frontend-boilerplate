---
"devc-frontend-generator": patch
---

Base `FieldLabel`로 감싼 `Checkbox`가 서버가 그린 HTML에서도 레이블 글자를 접근 가능한 이름으로 갖는다. Base UI는 hydration 뒤에야 체크박스를 레이블에 이어, 페이지를 연 직후에는 commerce의 결제 동의, multi-step-form의 약관 동의, optimistic-update의 할 일 같은 체크박스에 이름이 없었다. `FieldLabel`이 레이블의 id를 미리 정해 감싼 `Checkbox`에 알리므로 쓰는 법(`<Field><FieldLabel><Checkbox />약관에 동의합니다</FieldLabel></Field>`)은 그대로다.
