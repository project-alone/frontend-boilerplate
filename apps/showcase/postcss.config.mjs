// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/postcss.config.mjs

// Next.js(next dev·next build)와 Storybook(Vite)이 함께 읽는 PostCSS 설정. 여기서 Tailwind CSS를 켠다.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
