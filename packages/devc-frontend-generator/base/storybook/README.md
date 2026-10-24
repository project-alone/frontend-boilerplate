## Storybook

처음 `npm run g -- story <컴포넌트 파일>`을 실행했을 때 더해졌습니다("코드 생성(Schematic)"의 story).

```sh
npm run storybook        # Storybook(http://localhost:6006)
npm run test:storybook   # 스토리마다 브라우저(Chromium)에서 접근성(axe)과 play 함수 검사
```

- 설정: `.storybook/main.ts`(스토리 위치, 애드온), `.storybook/preview.tsx`(모든 스토리를 감싸는 것: Tailwind와 디자인 토큰, TanStack Query, 알림, App Router 흉내, 접근성 검사 기준), `.storybook/vitest-project.ts`(`config/vitest.config.ts`의 `storybook` 프로젝트).
- `npm run test:storybook`은 스토리마다 axe로 WCAG 2.2 AA를 검사하고, 위반이 하나라도 있으면 실패합니다. 스토리의 `play` 함수에 적은 상호작용 검사도 함께 돕니다. GitLab CI의 `test:storybook` 잡이 같은 검사를 합니다.
- 새 컴포넌트의 스토리도 `npm run g -- story <파일>`로 만듭니다. Storybook이 이미 있으므로 스토리 파일만 만듭니다. 컴포넌트가 보일 수 있는 상태(변형, 비활성, 오류 등)마다 스토리를 더하면 상태마다 접근성을 검사받습니다.
- Storybook에는 백엔드도 MSW도 없습니다. `.storybook/preview.tsx`는 스토리마다 새 QueryClient(실패한 요청을 다시 보내지 않음)로 감싸므로, 데이터를 직접 가져오는 컴포넌트는 요청이 실패한 화면을 보여 줍니다. 보여 줄 데이터는 스토리에서 데이터를 넣은 QueryClient로 감싸 정합니다. 데이터를 props로 받는 컴포넌트로 나누면 스토리에서 args로 바로 넘길 수 있습니다.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getListProductsResponseMock } from '@/shared/api/generated/products/products.msw'
import { listProductsQueryOptions } from '@/queries/products/products.queries'

export const Default: Story = {
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
      queryClient.setQueryData(listProductsQueryOptions().queryKey, getListProductsResponseMock())
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
}
```
