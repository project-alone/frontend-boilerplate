// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/lib/text.ts

// 공용 유틸: 글자 다루기. src/shared/lib/의 함수는 서버와 브라우저, 설정 파일(config/)이 불러오는 모듈 어디서나 쓸 수 있도록
// 표시(server-only 등)도 다른 모듈의 import도 두지 않은 순수 함수다(README의 "품질 기준").

/** 빈 문자열을 없는 값(undefined)으로 본다. .env 파일에 `NAME=`처럼 값 없이 적은 환경 변수는 빈 문자열이 된다. */
export function nonEmpty(value: string | undefined): string | undefined {
  return value === '' ? undefined : value
}

/** 끝의 슬래시를 모두 뗀다. 뒤에 `/경로`를 이어 붙일 주소에 쓴다(`https://api.example.com/` → `https://api.example.com`). */
export function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}
