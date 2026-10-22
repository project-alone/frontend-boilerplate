// 생성 코드에 적는 이름과 글자. 이름은 단어로 나눠 대소문자 규칙대로 잇고, 글자는 식별자·속성 접근·JSX로 적는다.

// JavaScript 식별자(유니코드 문자는 쓰지 않는다)
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/** 'Sales Stats', 'sales_stats', 'salesStats'를 모두 ['Sales', 'Stats']처럼 단어로 나눈다. */
export function splitWords(text: string): string[] {
  return text
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z\d]+/)
    .filter((word) => word !== '')
}

export function camelCase(words: readonly string[]): string {
  return words.map((word, index) => (index === 0 ? word.toLowerCase() : upperFirst(word))).join('')
}

export function pascalCase(words: readonly string[]): string {
  return words.map(upperFirst).join('')
}

/** 'createProduct'를 'CreateProduct'처럼 첫 글자만 대문자로 바꾸고 나머지는 그대로 둔다('XMLViewer'는 그대로). */
export function upperFirst(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

export function kebabCase(words: readonly string[]): string {
  return words.map((word) => word.toLowerCase()).join('-')
}

/** text가 JavaScript 식별자인지 본다. */
export function isIdentifier(text: string): boolean {
  return IDENTIFIER.test(text)
}

/** object의 속성 property를 읽는 식. 식별자면 object.property, 아니면 대괄호로 읽는다(object["a-b"]). */
export function propertyAccess(object: string, property: string): string {
  return isIdentifier(property) ? `${object}.${property}` : `${object}[${JSON.stringify(property)}]`
}

/** JSX 안의 글자. JSX가 해석하는 문자(중괄호, 꺾쇠, &)나 줄바꿈이 있으면 문자열 식으로 넣는다. */
export function jsxText(text: string): string {
  return /[{}<>&\n]/.test(text) ? `{${JSON.stringify(text)}}` : text
}
