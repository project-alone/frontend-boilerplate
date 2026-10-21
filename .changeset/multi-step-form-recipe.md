---
'devc-frontend-generator': minor
---

`multi-step-form` Recipe를 더한다(`dcgen new --recipe multi-step-form`, `server`와 `static-export`). `/partners/apply`의 입점 신청서가 세 단계로 나눠 입력받고 확인 단계에서 한 번에 보낸다. 단계마다 재생성 계층의 요청 본문 Zod 스키마에서 그 단계의 필드만 고른 스키마로 검증하고, 이전 단계로 돌아가거나 페이지를 새로 고쳐도(`sessionStorage`) 입력한 값이 남으며, 단계를 옮기면 포커스가 단계 제목으로, 검증에 실패하면 첫 오류 필드로 간다. 명세 조각으로 `submitPartnerApplication`(tag `partners`)을 더하고, 제출은 `npm run g -- mutation`으로 만든 뮤테이션 훅으로 보낸다. 다른 다단계 폼에도 쓸 `src/shared/multi-step-form`(`useFormSteps`, `StepForm`, `StepIndicator`)과 컴포넌트 테스트, 스토리, E2E가 함께 들어간다.
