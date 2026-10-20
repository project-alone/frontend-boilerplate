## 실행과 배포

이 Starter의 Rendering Mode는 `static-export`입니다. Next.js 서버 없이 정적 파일만으로 배포하며(`next.config.ts`의 `output: 'export'`), 특정 배포 방식에 묶이지 않도록 Vercel 같은 플랫폼 전용 설정은 두지 않습니다.

- `npm run build`는 모든 페이지를 빌드할 때 렌더링해 `out/`에 HTML·CSS·JS 같은 정적 파일로만 내보냅니다. 배포할 것은 `out/` 하나이고, 정적 파일을 서빙하는 어떤 서버나 호스팅에 올려도 됩니다.
- `npm run start`는 `out/`을 정적 파일 서버(sirv)로 띄웁니다. 기본 포트는 8080이고, `npm run start -- --port 3000`처럼 바꿉니다. E2E도 이 서버를 대상으로 돕니다.
- 서버 컴포넌트는 빌드할 때 한 번만 실행됩니다. 동적 라우트(`[id]` 등)는 `generateStaticParams`로 만들 경로를 모두 정해 두어야 합니다.
- 요청을 받는 서버가 있어야 하는 기능은 쓸 수 없고, 쓰면 `npm run dev`나 `npm run build`에서 오류가 납니다. 예: Request를 읽는 Route Handler, `cookies()`, Proxy(`proxy.ts`), `next.config.ts`의 rewrites·redirects·headers, ISR, 서버 액션, 기본 로더를 쓰는 이미지 최적화.
- MSW는 Vitest와 개발 서버(`npm run dev`)에서 아래의 "API 목킹(MSW)"대로 동작합니다. 다만 빌드할 때 서버 컴포넌트가 보내는 요청은 MSW가 받지 않고, E2E는 Next.js 서버 대신 정적 파일 서버를 띄우므로 E2E에서도 MSW가 요청을 받지 않습니다.
