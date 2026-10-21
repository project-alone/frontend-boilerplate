// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/process-env.seo.d.ts

// seo Recipe가 읽는 환경 변수. Base의 process-env.d.ts와 합쳐진다.
declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * 사이트의 공개 주소(예: https://www.example.com). sitemap, robots.txt, 페이지의 canonical·OG 주소를 만든다
     * (src/shared/seo/site.ts). 빌드할 때 코드에 박히므로 배포용 빌드에 넣는다.
     */
    readonly NEXT_PUBLIC_SITE_URL?: string
  }
}
