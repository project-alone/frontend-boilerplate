---
"devc-frontend-generator": minor
---

`docker` Recipe의 `Dockerfile`은 build 단계에서 빌드 인자 `NEXT_PUBLIC_SENTRY_DSN`도 받는다. `sentry` Recipe를 넣은 Starter의 배포용 이미지는 `docker build --build-arg NEXT_PUBLIC_SENTRY_DSN=<DSN>`으로 만들어야 브라우저 번들에 DSN이 담기고, 빠지면 브라우저의 오류는 보내지 않는다. 서버의 `SENTRY_DSN`은 지금처럼 실행할 때 컨테이너의 환경 변수로 넣는다.
