---
"devc-frontend-generator": minor
---

`dcgen g form`이 null을 받는 필드(3.1의 `type: [..., 'null']`, 3.0의 `nullable: true`, `{ type: 'null' }`과 묶은 `anyOf`·`oneOf`)와 반드시 true여야 하는 불리언(`const: true`, `enum: [true]`)을 폼으로 만든다. Base의 `formResolver`는 비워 둔 입력을 명세에 따라 보낸다. null을 받는 필수 필드는 `null`을, null을 받는 선택 필드는 처음 값(새 옵션 `defaultValues`)이 있던 입력을 비웠을 때만 `null`을 보내고, 그 밖의 선택 필드는 보내지 않는다. 반드시 true여야 하는 체크박스를 체크하지 않으면 `MUST_CHECK_MESSAGE`("반드시 체크해야 합니다.")로 알린다. null을 받는 필드가 있는 폼에는 필수 입력만 채워 보냈을 때의 요청 본문을 확인하는 테스트를 함께 만든다. 새 Base 훅 `useSchemaForm(schema, { defaultValues })`은 처음 값을 `useForm`과 `formResolver`에 함께 넘겨, 현재 값을 채운 수정 폼도 처음 값을 한 번만 적는다. `g form`이 만드는 폼도 이 훅을 쓴다.
