---
"devc-frontend-generator": patch
---

Starter README의 "테스트"에 Linux에서 브라우저 테스트가 가끔 실패하는 경우를 더한다. 같은 호스트에서 Docker 컨테이너가 뜨거나 내려가면 네트워크 인터페이스가 바뀌고, Linux의 Chromium은 그때 `localhost`로 보내던 요청까지 `net::ERR_NETWORK_CHANGED`로 끊는다. 그러면 `test:storybook`이 `Failed to fetch dynamically imported module`이나 `The iframe ... did not become ready`로 실패할 수 있다. Chromium에는 이를 끄는 설정이 없으므로 컨테이너를 다 띄운 뒤에 브라우저 테스트를 돌리고, CI에서는 컨테이너를 만드는 잡과 브라우저 테스트를 한 호스트에서 동시에 돌리지 말라고 적었다.
