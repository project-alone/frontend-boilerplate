// 차트가 배경 위에서 읽히는지 확인하는 테스트용 계산(chart Recipe의 스토리와 E2E가 쓴다). axe는 글자의 명도 대비만 보고
// SVG의 선·막대 같은 그래픽은 보지 않으므로, 브라우저가 계산한 색(getComputedStyle)으로 직접 잰다.

/** 그래픽(선, 막대)과 배경 사이의 최소 명도 대비(WCAG 2.2 1.4.11) */
export const NON_TEXT_CONTRAST_MIN = 3
/** 글자(축 눈금)와 배경 사이의 최소 명도 대비(WCAG 2.2 1.4.3) */
export const TEXT_CONTRAST_MIN = 4.5

/** getComputedStyle이 돌려주는 불투명한 색(`rgb(26, 26, 26)`)의 상대 휘도 */
function relativeLuminance(color: string): number {
  const channels = /^rgba?\(([^)]+)\)$/
    .exec(color.trim())?.[1]
    ?.split(/[\s,/]+/)
    .map(Number)
  if (channels === undefined || channels.length < 3 || channels.slice(0, 3).some(Number.isNaN)) {
    throw new Error(`명도 대비를 잴 수 없는 색입니다: ${color}`)
  }
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** 두 색의 명도 대비(1~21) */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a)
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}
