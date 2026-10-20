// 환경 변수 파일(.env, .env.development, .env.example 등)을 변수 단위로 병합한다. 여러 overlay가 같은 파일에 자기 변수를
// 더해도 서로 덮어쓰지 않도록, overlay의 dotenv 파일은 파일을 대신하지 않고 Starter의 같은 파일에 병합한다(overlay.ts).

/** overlay 안에서 병합할 dotenv 파일인지. `.env`와 `.env.<이름>`이다. */
export function isDotenvFile(path: string): boolean {
  return /^(?:.*\/)?\.env(?:\.[\w.-]+)?$/.test(path)
}

// `NAME=값`(앞에 export가 붙어도 된다) 줄
const VARIABLE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/

/** 빈 줄로 나뉜 문단 안의 항목. 변수는 바로 위의 주석과 한 항목이고, 변수에 붙지 않은 주석은 key가 없다. */
interface Item {
  key: string | undefined
  lines: string[]
}

/**
 * overlay의 dotenv 파일을 base에 병합한 내용을 돌려준다. 변수와 그 바로 위의 주석(빈 줄 없이 붙은 주석)을 한 항목으로 보고,
 * base에 같은 변수가 있으면 그 항목을 그 자리에서 바꾼다. 나머지(새 변수와 변수에 붙지 않은 주석)는 overlay의 문단 그대로
 * base의 끝에 덧붙인다. 같은 문단이 이미 있으면 다시 덧붙이지 않는다.
 */
export function mergeDotenv(base: string, overlay: string): string {
  const paragraphs = parseParagraphs(base)
  const positions = new Map<string, Item>()
  for (const item of paragraphs.flat()) if (item.key !== undefined) positions.set(item.key, item)

  for (const paragraph of parseParagraphs(overlay)) {
    const added = paragraph.filter((item) => {
      const existing = item.key === undefined ? undefined : positions.get(item.key)
      if (existing === undefined) return true
      existing.lines = item.lines
      return false
    })
    const text = render([added])
    if (added.length > 0 && !paragraphs.some((existing) => render([existing]) === text)) {
      paragraphs.push(added)
      for (const item of added) if (item.key !== undefined) positions.set(item.key, item)
    }
  }
  return `${render(paragraphs)}\n`
}

function parseParagraphs(text: string): Item[][] {
  return text
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.split('\n').filter((line) => line.trim() !== ''))
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const items: Item[] = []
      let pending: string[] = []
      for (const line of lines) {
        const key = VARIABLE.exec(line)?.[1]
        pending.push(line)
        if (key !== undefined) {
          items.push({ key, lines: pending })
          pending = []
        }
      }
      if (pending.length > 0) items.push({ key: undefined, lines: pending })
      return items
    })
}

function render(paragraphs: readonly (readonly Item[])[]): string {
  return paragraphs.map((paragraph) => paragraph.flatMap((item) => item.lines).join('\n')).join('\n\n')
}
