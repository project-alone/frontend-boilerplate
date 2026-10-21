// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/process-env.auth.d.ts

// auth Recipe가 읽는 환경 변수. Base의 process-env.d.ts와 합쳐진다.
declare namespace NodeJS {
  interface ProcessEnv {
    /** 로그인 세션 쿠키를 암호화하는 32자 이상의 비밀 값(src/shared/auth/session.ts). 배포하는 서버에는 꼭 넣는다. */
    readonly SESSION_SECRET?: string
  }
}
