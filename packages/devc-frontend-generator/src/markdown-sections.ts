interface Section {
  /** `## `로 시작하는 제목 줄. 첫 제목 앞의 내용은 undefined다. */
  heading: string | undefined
  lines: string[]
}

/**
 * overlay의 절(`## ` 제목부터 다음 `## ` 제목 앞까지)을 base에 덧입힌다. base에 같은 제목의 절이 있으면 그 자리에서
 * 바꾸고, 없으면 끝에 덧붙인다. overlay는 `## ` 제목으로 시작해야 한다.
 */
export function mergeMarkdownSections(base: string, overlay: string): string {
  const merged = splitSections(base)
  const [preamble, ...sections] = splitSections(overlay)
  if (preamble !== undefined && preamble.lines.some((line) => line.trim() !== '')) {
    throw new Error('덧입힐 Markdown은 `## ` 제목으로 시작해야 합니다.')
  }
  for (const section of sections) {
    const index = merged.findIndex(({ heading }) => heading === section.heading)
    if (index === -1) merged.push(section)
    else merged[index] = section
  }
  return `${merged.map(({ lines }) => trimBlankLines(lines).join('\n')).join('\n\n')}\n`
}

// 코드 블록 안의 `## `(예: 셸 주석)은 제목으로 보지 않는다.
function splitSections(markdown: string): Section[] {
  const sections: Section[] = []
  let current: Section = { heading: undefined, lines: [] }
  sections.push(current)
  let inCodeBlock = false
  for (const line of markdown.split('\n')) {
    if (/^(?:```|~~~)/.test(line)) inCodeBlock = !inCodeBlock
    if (!inCodeBlock && line.startsWith('## ')) {
      current = { heading: line.trimEnd(), lines: [] }
      sections.push(current)
    }
    current.lines.push(line)
  }
  return sections
}

function trimBlankLines(lines: string[]): string[] {
  const isBlank = (line: string | undefined) => line !== undefined && line.trim() === ''
  const trimmed = [...lines]
  while (isBlank(trimmed[0])) trimmed.shift()
  while (isBlank(trimmed.at(-1))) trimmed.pop()
  return trimmed
}
