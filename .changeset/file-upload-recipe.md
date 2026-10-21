---
"devc-frontend-generator": minor
---

`file-upload` Recipe를 더한다(`dcgen new --recipe file-upload`, `server`와 `static-export`). `/upload` 페이지에서 파일을 고르거나(키보드로 여는 파일 선택 버튼) 끌어 놓아 올리고, 파일마다 진행 막대로 진행률을 알리며, 올리는 중에 취소하고, 실패하거나 취소한 업로드를 다시 시도한다. 명세 조각으로 파일 하나를 `multipart/form-data`로 받는 `uploadFile`(tag `files`, 5MB 이하의 PNG·JPEG·PDF·텍스트, 넘으면 413·415)을 더하고, 받지 않는 크기·형식은 보내기 전에 이유와 함께 거른다. fetch로는 업로드 진행률을 알 수 없으므로 같은 요청을 XMLHttpRequest로 보내는 `apiUpload`(`src/shared/upload`)를 더한다. `apiFetch`와 같은 주소(`server`는 BFF 프록시, `static-export`는 백엔드)로 보내고, 실패는 `ApiError`로, 응답은 명세의 Zod 스키마로 검증한다. 파일 이름으로 지연·실패를 고르는 MSW 핸들러, 컴포넌트 테스트, 진행률·취소·재시도·접근성을 보는 E2E가 함께 들어간다.
