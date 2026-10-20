## 테이블

`table` Recipe로 넣었습니다. `/members` 페이지가 [TanStack Table](https://tanstack.com/table)로 회원 목록을 보여 주고, 열 머리글로 정렬하고, 검색어와 역할로 거르고, 페이지를 넘깁니다. 정렬·필터·페이지는 백엔드가 처리합니다. 테이블은 그 상태만 들고 있다가 쿼리 파라미터로 바꿔 보내므로, 목록이 길어져도 브라우저가 모든 행을 받지 않습니다.

- 명세: `openapi.yaml`의 `listMembers`(`GET /members`, tag `members`)가 `q`(이름·이메일 검색어), `role`, `sort`(`name`, `email`, `joinedAt`), `order`(`asc`, `desc`), `page`, `pageSize`를 받아 한 페이지(`MemberPage`: `items`, `total`, `page`, `pageSize`)를 돌려줍니다.
- Query Domain: `src/queries/members/`는 `npm run g -- query listMembers`가 만든 코드 그대로입니다. 테이블의 상태가 `listMembersQueryOptions(params)`의 인자가 되므로 쿼리 키(`['members', 'listMembers', params]`)와 요청 파라미터가 늘 같습니다. 상태가 바뀌면 새로 요청하고, 다음 결과를 받는 동안에는 지금 결과를 보여 줍니다(`keepPreviousData`).
- 테이블: `src/features/member-table/member-table.tsx`. 행을 정렬·필터·페이지로 나누는 일은 백엔드에 맡기고(`manualSorting`, `manualFiltering`, `manualPagination`), 정렬(`sorting`), 역할 열 필터(`columnFilters`), 검색어(`globalFilter`), 페이지(`pagination`) 상태를 `toListMembersParams`가 쿼리 파라미터로 바꿉니다. 정렬이나 필터를 바꾸면 첫 페이지로 돌아갑니다. 다른 목록에 쓰려면 이 파일을 복사해 열 정의(`columns`)와 이 함수, 쓰는 queryOptions를 바꿉니다.
- 키보드와 스크린 리더: 정렬은 열 머리글 안의 버튼(Enter·Space, 오름차순 → 내림차순 → 정렬 없음)이고, 정렬한 열의 머리글에 `aria-sort`가 붙습니다. 검색어는 입력한 뒤 Enter로 보내고, 역할은 공통 `Select`(화살표 키)로 고릅니다. 결과("회원 24명 중 1–10번째")는 상태 문구(`role="status"`)로 알립니다.
- Rendering Mode: 두 Rendering Mode 모두 페이지 뼈대만 미리 만들고 목록은 브라우저가 가져옵니다(`server`는 BFF 프록시, `static-export`는 백엔드 주소로 직접). 정렬·필터를 바꿀 때마다 브라우저가 다시 요청하므로 서버에서 미리 가져오지(prefetch) 않습니다.
- MSW: 생성된 핸들러는 명세의 `example`을 그대로 돌려주므로, `src/shared/mocks/members.ts`의 핸들러가 고정된 회원 24명을 파라미터대로 거르고 정렬해 돌려줍니다. `src/shared/mocks/handlers.ts`에서 생성된 핸들러보다 앞에 둡니다. 실제 백엔드로 바꾸면 이 파일과 `handlers.ts`의 `membersHandlers`를 지웁니다.
- 테스트: `src/features/member-table/member-table.test.tsx`(정렬·검색·역할 필터·페이지가 요청 파라미터와 쿼리 키로 이어짐, `aria-sort`, 키보드 정렬, 빈 결과, 실패), `e2e/table.spec.ts`(빌드한 앱에서 키보드로 정렬·검색·필터, 페이지 이동, 접근성).
- 샘플을 지우려면 `src/app/members/`, `src/features/member-table/`, `src/queries/members/`, `src/shared/mocks/members.ts`(와 `handlers.ts`의 `membersHandlers`), `e2e/table.spec.ts`를 지우고 `openapi.yaml`에서 `listMembers`를 뺀 뒤 `npm run api:gen`을 실행합니다.
