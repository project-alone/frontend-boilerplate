import axe from 'axe-core'
import { WCAG_22_AA_TAGS } from './wcag-tags'

/**
 * 컴포넌트 테스트(Vitest, jsdom)에서 root 안의 접근성(WCAG 2.2 AA) 위반을 axe로 찾아 `<규칙>: <설명> (<요소>)`로 돌려준다.
 * 위반이 없으면 빈 배열이다. 포털로 문서의 body에 그리는 팝업(선택 목록, 대화상자, 알림)까지 보려면 document.body를 넘긴다.
 * jsdom은 화면을 그리지 않아 색을 계산하지 못하므로 명도 대비(color-contrast)는 끄고, E2E가 실제 브라우저에서 검사한다.
 */
export async function axeViolations(root: Element): Promise<string[]> {
  const { violations } = await axe.run(root, {
    runOnly: { type: 'tag', values: WCAG_22_AA_TAGS },
    rules: { 'color-contrast': { enabled: false } },
  })
  return violations.flatMap(({ id, help, nodes }) => nodes.map(({ target }) => `${id}: ${help} (${target.join(' ')})`))
}
