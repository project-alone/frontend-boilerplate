/** 'Sales Stats', 'sales_stats', 'salesStats'를 모두 ['Sales', 'Stats']처럼 단어로 나눈다. */
export function splitWords(text: string): string[] {
  return text
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z\d]+/)
    .filter((word) => word !== '')
}

export function camelCase(words: readonly string[]): string {
  return words
    .map((word, index) => (index === 0 ? word.toLowerCase() : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
    .join('')
}

/** 'createProduct'를 'CreateProduct'처럼 첫 글자만 대문자로 바꾼다. */
export function upperFirst(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

export function kebabCase(words: readonly string[]): string {
  return words.map((word) => word.toLowerCase()).join('-')
}
