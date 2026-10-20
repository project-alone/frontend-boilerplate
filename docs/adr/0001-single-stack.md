# 스택은 React + Next.js(App Router) 하나로 고정한다

"가능한 한 많은 케이스"를 담는 것이 목표지만, 다양성은 Rendering Mode, Recipe, Archetype 축으로만 늘리고 프레임워크·라이브러리 축으로는 늘리지 않는다. 팀은 프레임워크와 라이브러리를 정해 두고 시작하므로, 멀티 프레임워크 버전(Vue, Svelte 등)이나 같은 문제의 대안 비교(예: Zustand vs Jotai vs Redux)는 두지 않는다. Next.js는 SSR, SSG, ISR, 스트리밍, 정적 export를 한 프레임워크 안에서 모두 지원해 Rendering Mode 축을 담기에 적합하고, 팀이 이미 써 온 스택이라 선택했다.

## Considered Options

- **React Router v7 (framework mode)**: SPA, SSR, 사전 렌더링을 지원하고 벤더 종속이 덜하지만, ISR 등 Rendering Mode 범위가 좁다.
- **TanStack Start**: 타입 안전성은 가장 강하지만 상대적으로 신생이다.
- **Vite SPA**: 단순하지만 SPA만 가능해 Rendering Mode 축을 담을 수 없다.
