// Rendering Mode static-export가 읽는 환경 변수. Base의 process-env.d.ts와 합쳐진다.
declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * 브라우저가 부르는 백엔드 주소(src/shared/api/base-url.ts). static-export에는 BFF 프록시가 없어 브라우저가 백엔드를 직접
     * 부른다. 빌드할 때 브라우저 번들에 박히므로 배포용 빌드를 만드는 환경에 넣는다.
     */
    readonly NEXT_PUBLIC_API_BASE_URL?: string
  }
}
