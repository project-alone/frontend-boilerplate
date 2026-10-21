## 다단계 폼

`multi-step-form` Recipe로 넣었습니다. `/partners/apply` 페이지가 입점 신청서를 사업자 정보 → 담당자 정보 → 판매 계획 → 신청 내용 확인의 네 단계로 나눠 입력받고, 확인 단계에서 모든 입력을 한 번에 보냅니다. 가입, 주문서처럼 긴 입력을 나눠 받는 화면의 틀로 씁니다.

| 위치                                | 내용                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/shared/multi-step-form/`       | 다른 다단계 폼에도 쓰는 부품: 단계 상태(`use-form-steps.ts`), 단계 폼(`step-form.tsx`), 단계 표시, 저장소 |
| `src/features/partner-application/` | 샘플 입점 신청서. 단계(`partner-application-steps.tsx`), 확인 단계, 단계를 잇는 폼                        |
| `src/queries/partners/`             | `partners` Query Domain(`npm run g -- mutation submitPartnerApplication`이 만든 코드 그대로)              |
| `src/app/partners/apply/`           | `/partners/apply` 라우트                                                                                  |

- 명세: `openapi.yaml`의 `submitPartnerApplication`(`POST /partner-applications`, tag `partners`)이 세 단계의 입력을 요청 본문(`PartnerApplication`) 하나로 받습니다. MSW 목은 명세의 `example`(접수 번호 `PA-0001`)을 돌려줍니다.
- 단계마다 검증: 단계마다 재생성 계층의 요청 본문 스키마(`SubmitPartnerApplicationBody`)에서 그 단계의 필드만 고른 스키마(`.pick({ ... })`)로 검증합니다. 그래서 검증 규칙은 명세에서만 오고, 아직 입력하지 않은 다음 단계의 필드는 오류로 알리지 않습니다. 단계마다 `StepForm`이 React Hook Form 폼을 하나씩 만들고, 입력 요소와 오류 표시는 `npm run g -- form`이 만드는 폼을 따릅니다(Base의 "폼"). 다만 판매 분야의 선택지는 enum 값 대신 화면에 보일 이름(`CATEGORY_LABELS`)으로 보입니다. 약관 동의는 명세에 `const: true`로 적어 체크하지 않으면 `formResolver`가 다른 폼처럼 `MUST_CHECK_MESSAGE`("반드시 체크해야 합니다.")로 알립니다. 단계 폼은 앞뒤 단계에서 입력한 값을 `useSchemaForm`의 처음 값으로 넘깁니다.
- 값 유지: "다음"은 그 단계의 검증을 통과한 뒤, "이전"은 검증하지 않고 지금 입력한 그대로를 모든 단계의 값(`useFormSteps`의 `draft`)에 담습니다. 단계를 오가도 입력한 값이 남습니다. 확인 단계의 "수정"은 그 단계로 돌아가고, "다음"으로 뒤 단계를 차례로 지나(값은 남아 있습니다) 다시 확인 단계로 옵니다.
- 한 번에 제출: 확인 단계의 "신청하기"가 모든 단계의 값을 요청 본문 스키마 전체로 한 번 더 검증한 뒤 `useSubmitPartnerApplicationMutation`으로 한 번 보냅니다. 성공하든 실패하든 알림(토스트)으로 알리고, 성공하면 처음 단계로 돌아가 비웁니다. 실패하면 확인 단계에 값을 그대로 둬 다시 신청할 수 있습니다. 보내는 동안에는 "이전", "수정", "신청하기"를 끕니다(돌아가 고친 값은 보낸 요청에 담기지 않으므로). 성공한 뒤의 동작(완료 페이지로 이동 등)은 화면에 맞게 고칩니다.
- 새로 고침: 단계와 입력한 값을 `sessionStorage`(`partner-application-draft`)에 둬, 페이지를 새로 고치면 이어서 입력합니다. 탭을 닫거나 신청에 성공하면 지워지고, 다른 탭과는 나누지 않습니다. 저장한 값은 그린 뒤에 읽으므로 서버가 보낸 첫 단계가 잠깐 보였다가 이어 갑니다. 저장한 값은 지금 명세의 규칙에 맞지 않을 수 있으므로(다른 버전의 앱이 저장 등) 신청할 때 맞지 않는 값이 있는 첫 단계로 돌아가 오류를 알립니다. 비밀번호, 카드 번호 같은 비밀 값을 받는 폼에서는 그 값을 저장하지 않도록 `useFormSteps`의 `save`, `next`, `back`에 넘기기 전에 빼거나 저장을 끕니다.
- 접근성: 단계 표시(`StepIndicator`)는 지금 단계를 `aria-current="step"`으로, 끝낸 단계를 "(완료)"로 알립니다. 단계를 옮기면 포커스가 그 단계의 제목("담당자 정보 (4단계 중 2단계)")으로 가서 스크린 리더가 지금 단계를 읽고, 검증에 실패하면 첫 오류 필드로 갑니다. 처음 열 때와 새로 고쳐 이어 갈 때는 포커스를 옮기지 않습니다. 브라우저의 뒤로 가기는 단계가 아니라 이전 페이지로 갑니다.
- Rendering Mode: 페이지 뼈대(첫 단계)는 빌드할 때 미리 만들고, 단계와 값은 브라우저가 들고 있다가 신청할 때만 요청합니다(`server`는 BFF 프록시, `static-export`는 백엔드 주소로 직접). 그래서 두 Rendering Mode에서 같은 코드로 동작합니다.
- 다른 다단계 폼 만들기: 명세에 요청 본문이 있는 operation을 더하고 `npm run api:gen`, `npm run g -- mutation <operationId>`를 실행한 뒤, `src/features/partner-application/`을 복사해 `partner-application-steps.tsx`의 단계(제목, `.pick`으로 고른 스키마, 입력 요소, 확인 단계에 보일 값)와 폼의 요청 본문 스키마, 뮤테이션 훅, 저장소 키를 바꿉니다. 단계를 더하거나 순서를 바꿀 때도 단계 목록(`PARTNER_APPLICATION_STEPS`)만 고칩니다.
- 테스트: `src/features/partner-application/partner-application-form.test.tsx`(단계마다 그 단계만 검증, 첫 오류 필드와 단계 제목으로 포커스, 이전·다음과 수정 뒤에도 값 유지, 한 번에 보내는 요청 본문, 실패, 보내는 동안 끈 버튼, 새로 고침과 맞지 않는 저장 값), `src/shared/multi-step-form/draft-storage.test.ts`(저장소를 읽고 쓰지 못할 때와 모양이 다른 값), `partner-application-form.stories.tsx`(첫 단계, 검증 오류, 확인 단계의 axe 검사. `dark-mode`가 있으면 다크 모드 브라우저에서도 실행), `e2e/multi-step-form.spec.ts`(빌드한 앱에서 끝까지 신청, 검증 오류와 키보드 입력, 이전·다음과 새로 고침, 운영체제가 라이트·다크 모드일 때의 axe 검사).
- 샘플을 지우려면 `src/app/partners/`, `src/features/partner-application/`, `src/queries/partners/`, `e2e/multi-step-form.spec.ts`와 `openapi.yaml`의 `partners` tag·경로·스키마(`PartnerApplication`, `PartnerCategory`, `PartnerApplicationReceipt`)를 지우고 `npm run api:gen`을 실행합니다. 새 다단계 폼에 쓸 `src/shared/multi-step-form/`은 남겨 둡니다.
