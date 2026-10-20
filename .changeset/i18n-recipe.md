---
"devc-frontend-generator": minor
---

`i18n` Recipe를 더한다(`dcgen new --recipe i18n`, `server`와 `static-export`). next-intl로 한국어(기본 locale `ko`)와 영어(`en`)를 지원한다. 번역한 페이지는 `src/app/[locale]/` 아래에 두어 주소 앞에 locale이 붙고(`/ko`, `/en/i18n`) locale마다 빌드할 때 렌더링하며, Base의 홈은 이 아래로 옮긴다. 다른 Recipe와 Base의 `[locale]` 밖 페이지는 옮기지 않고 그대로 둔다. 머리글의 locale 전환 UI, `ko.json`의 타입으로 검사하는 메시지 키(없는 키는 타입 오류), server Starter에서 홈(`/`)을 저장한 locale·브라우저 언어·기본 locale 순으로 고른 locale의 홈으로 보내는 proxy 처리기, 날짜·통화·복수형을 보여 주는 다국어 예시 페이지와 테스트를 함께 넣는다.
