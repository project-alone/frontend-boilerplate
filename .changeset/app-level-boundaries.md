---
"devc-frontend-generator": minor
---

Base에 앱 수준의 오류·로딩·404 화면을 더한다. 페이지를 렌더링하다 오류가 나면 `src/app/error.tsx`가 디자인 토큰과 공통 UI(`Button`)로 그린 오류 화면과 "다시 시도"를 보이고, 루트 레이아웃에서 난 오류는 `src/app/global-error.tsx`가 자기 `<html lang="ko">`와 스타일로 같은 화면을 그린다. 없는 주소에는 `src/app/not-found.tsx`의 404 화면이 상태 코드 404와 함께 나오고, `src/app/loading.tsx`가 앱 수준의 로딩 상태가 된다. `npm run g -- page`와 Archetype이 만든 라우트 수준의 경계는 지금처럼 그 라우트에서 먼저 받는다. 화면마다 스토리(axe 검사)와 `e2e/not-found.spec.ts`가 함께 들어간다.

- 앱 수준 로딩 상태를 먼저 보내므로, 요청마다 렌더링하는 페이지(SSR, 스트리밍)에서 그 뒤에 난 렌더링 오류와 `notFound()`는 상태 코드 500·404 대신 200 응답의 오류 화면·404 화면(`noindex`)으로 알린다. 없는 주소와 SSG·ISR 페이지의 `notFound()`는 그대로 404다.
- `static-export`: `npm run start`가 `sirv-cli` 대신 `scripts/serve-out.ts`(sirv)로 `out/`을 띄우고, 정적 호스팅처럼 없는 주소에 빌드가 404 화면으로 만든 `out/404.html`을 상태 코드 404로 보낸다. 배포할 호스팅도 같게 설정한다.
- `sentry` Recipe: Next.js는 오류 경계가 잡은 브라우저의 렌더링 오류를 콘솔에만 남기므로, 앱 수준의 오류 화면(`src/app/error.tsx`)이 받은 오류를 `Sentry.captureException`으로 보낸다. 서버 컴포넌트의 오류는 서버의 `onRequestError`가 보내므로 다시 보내지 않는다.

이미 만든 Starter는 새 Generator로 같은 Rendering Mode와 Recipe의 Starter를 만들어 `src/app/error.tsx`, `global-error.tsx`, `loading.tsx`, `not-found.tsx`, 세 스토리(`error.stories.tsx`, `not-found.stories.tsx`, `loading.stories.tsx`), `e2e/not-found.spec.ts`를 옮긴다. 루트 레이아웃의 `<html lang>`을 바꿨다면 `global-error.tsx`의 `lang`도 맞춘다. `static-export` Starter는 `scripts/serve-out.ts`도 옮기고 `package.json`의 `start`를 `node scripts/serve-out.ts`로, devDependency `sirv-cli`를 `sirv`(`3.0.2`)로 바꾼다. `sentry` Recipe를 넣은 Starter는 새로 만든 Starter의 `src/app/error.tsx`를 옮기면 Sentry로 보내는 코드까지 들어 있다.
