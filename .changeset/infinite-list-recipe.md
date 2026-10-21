---
"devc-frontend-generator": minor
---

`infinite-list` Recipe를 더한다(`dcgen new --recipe infinite-list`, `server`와 `static-export`). `/articles`는 목록 끝이 화면에 들어오면(`IntersectionObserver`) 다음 페이지를 불러와 이어 붙이고 빈 페이지를 받으면 멈추는 무한 스크롤 목록이고, `/articles/pagination`은 같은 게시글을 쪽 번호로 넘겨 보는 번호형 페이지네이션이다. 스크롤하지 않는 키보드·스크린 리더 사용자를 위한 더 보기 버튼(새로 불러온 첫 항목으로 포커스를 옮긴다), 불러오는 중·모두 불러옴·실패와 다시 시도 상태를 함께 넣는다. 명세 조각으로 페이지 번호를 받아 게시글 한 페이지를 돌려주는 `listArticles`와 전체 개수를 돌려주는 `countArticles`(tag `articles`)를 더하고, Query Domain(`src/queries/articles`)은 `npm run g -- query listArticles --infinite` 등이 만든 infiniteQueryOptions·queryOptions 그대로다. 다른 목록에도 쓰는 `src/shared/paging`(`InfiniteList`, `Pagination`), 페이지 번호대로 나눠 돌려주는 MSW 핸들러, 컴포넌트 테스트, 스토리, E2E가 함께 들어간다.
