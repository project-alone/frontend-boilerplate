// Recipe가 읽는 환경 변수의 타입은 Recipe 자신의 선언 파일에 둔다. TypeScript가 types/process-env.d.ts의 선언과 합친다.
declare namespace NodeJS {
  interface ProcessEnv {
    /** 시험용: next.config 래퍼(extension-a-fixture, extension-b-fixture)가 적용된 순서 */
    readonly FIXTURE_NEXT_CONFIG?: string
    /** 시험용: extension-a-fixture가 .env.development에 더한 값 */
    readonly FIXTURE_A_DEV?: string
  }
}
