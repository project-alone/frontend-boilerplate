---
"devc-frontend-generator": minor
---

확장 지점 sitemap 규칙(`extensions.json`의 `sitemap`)을 더한다. 페이지를 더한 Recipe가 자기 페이지를 sitemap과 robots.txt에 어떻게 알릴지(`exclude`: sitemap에서 뺄 주소, `disallow`: robots.txt가 막을 주소, `locales`: locale을 받는 동적 세그먼트) 선언하면, Generator가 Starter에 sitemap(`src/app/sitemap.ts`)이 있을 때만 `src/app/sitemap-rules.ts`로 조립하고 seo Recipe의 sitemap과 robots.txt가 그 규칙을 따른다. locale마다 넣은 페이지는 sitemap에서 같은 페이지의 locale별 주소(hreflang)를 서로 알린다. seo의 E2E는 홈을 다른 주소로 보내는 Recipe와 함께 넣어도 통과하고, sitemap의 페이지가 모두 다른 주소로 보내지 않고 200으로 응답하는지 본다.
