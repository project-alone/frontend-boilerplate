---
"devc-frontend-generator": minor
---

`docker` Recipe를 더한다(`dcgen new --recipe docker`, `server`만). `standalone` 출력으로 Next.js 서버만 담는 멀티스테이지 `Dockerfile`(deps → build → runtime)과 `.dockerignore`, 캐시하지 않고 `{"status":"ok"}`를 돌려주는 상태 확인 주소 `GET /api/health`를 넣는다. 기반 이미지는 `.nvmrc`와 같은 메이저 버전의 Node를 정확한 버전으로 고정하고, 컨테이너는 root가 아닌 사용자(uid 1000)로 실행되며 `HEALTHCHECK`가 상태 확인 주소를 부른다. 이미지는 목을 끈 배포용 빌드로만 만들어 `API_MOCKING=enabled`를 거부하고, 백엔드 없이 띄워 볼 목 이미지는 `--target mock`으로 따로 만든다. 비밀 값은 이미지에 넣지 않도록 빌드할 때의 npm 토큰은 `--secret`으로 넘기고 로컬 환경 변수 파일(`.env*.local`)은 빌드 컨텍스트에서 뺀다. Starter의 README는 빌드 인자와 환경 변수, 목 이미지, GitLab CI에 이미지 빌드 잡을 더하는 방법을 담는다.
