# 쿼리 키는 operationId로 나누고, Query Domain은 쿼리 훅 대신 queryOptions를 내보낸다

Query Domain의 쿼리 키는 `['<domain>', '<operationId>', ...인자]`로 만들고(infinite 쿼리는 operationId 뒤에 `'infinite'` 단계를 더한다), 쿼리는 감싼 훅 대신 `<operationId>QueryOptions`·`<operationId>InfiniteQueryOptions`로 내보내 컴포넌트가 `useQuery`·`useSuspenseQuery`·`useInfiniteQuery`에 바로 넘긴다. spec(#1)이 예로 든 `['business', 'list', params]`처럼 operation의 종류로 나누면 한 Query Domain에 목록 operation이 여럿일 때 키가 겹치므로, 명세에서 기계적으로 정해지고 겹치지 않는 operationId를 쓴다. queryOptions 하나를 서버 컴포넌트의 prefetch와 클라이언트의 여러 훅이 함께 쓰므로 쿼리는 훅으로 감싸지 않고, 무효화·낙관적 업데이트 같은 결정을 담아야 하는 뮤테이션만 훅으로 만든다(#10).

## Considered Options

- **`['<domain>', 'list' | 'detail', ...인자]`(spec의 예)**: 흔한 모양이고 목록 쿼리 전체를 키 하나로 무효화할 수 있지만, 같은 Query Domain의 목록 operation 둘이 같은 키를 써 캐시가 섞인다. operation을 어느 종류로 볼지도 명세만으로 정할 수 없다.
- **쿼리마다 `use<Operation>Query` 훅**: 호출하는 쪽은 짧아지지만 `useQuery`, `useSuspenseQuery`, prefetch마다 따로 만들어야 하고, 옵션을 덮어쓰는 방법이 훅마다 달라진다.

## Consequences

- 무효화 범위는 `<domain>Keys.all`(Query Domain 전체)이나 `[...<domain>Keys.all, '<operationId>']`(operation 하나의 모든 인자)로 정한다. 목록 쿼리만 묶어 무효화하려면 그 operation들의 키를 나열한다.
- 백엔드가 operationId를 바꾸면 쿼리 키와 queryOptions 이름도 바뀐다.
