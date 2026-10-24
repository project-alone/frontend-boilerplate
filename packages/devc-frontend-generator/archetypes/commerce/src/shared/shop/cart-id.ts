import { useEffect, useSyncExternalStore } from 'react'
import { isNotFound } from './shop-errors'

// 커머스 Archetype: 이 브라우저의 장바구니 id. 장바구니는 로그인 없이 쓰는 손님 장바구니라, 처음 담을 때 백엔드가 만든
// 장바구니(명세의 createCart)의 id만 브라우저에 두고 장바구니 operation의 경로에 담아 부른다. 담긴 상품과 가격은 백엔드가 들고
// 있으므로 프론트엔드에는 DB도 세션도 필요 없다. 다음 방문에도 같은 장바구니를 쓰도록 sessionStorage 대신 localStorage에 두고,
// 다른 탭에서 바뀌면(storage 이벤트) 함께 바뀐다. 저장소를 쓸 수 없는 브라우저(저장소를 막은 설정 등)에서는 페이지를 새로
// 고치기 전까지 메모리에만 둔다.
//
// 로그인한 사용자의 장바구니를 계정에 묶으려면 백엔드가 accessToken으로 장바구니를 찾게 한다(auth Recipe의 BFF 프록시가 토큰을
// 붙인다). 로그인할 때 손님 장바구니를 계정의 장바구니에 합치는 일도 백엔드가 맡는다.

const STORAGE_KEY = 'shop-cart-id'

const listeners = new Set<() => void>()

// localStorage를 쓸 수 없을 때 대신 들고 있는 값
let memoryCartId: string | null = null

/**
 * 이 브라우저의 장바구니 id. 장바구니가 없으면 null이다. 서버가 렌더링할 때와 hydration 중에는 브라우저의 저장소를 읽지 않으므로
 * undefined(아직 모름)이고, hydration이 끝나면 저장한 값으로 다시 그린다. 그래서 서버가 보낸 HTML과 첫 렌더링이 어긋나지 않는다.
 */
export function useCartId(): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(STORAGE_KEY)
      } catch {
        return memoryCartId
      }
    },
    () => undefined,
  )
}

/** 백엔드가 만든 장바구니의 id를 저장한다(createCart가 성공했을 때). */
export function rememberCartId(cartId: string): void {
  writeCartId(cartId)
}

/** 저장한 장바구니 id를 지운다(주문을 마쳤거나 백엔드에 그 장바구니가 없을 때). 다음에 담으면 새 장바구니를 만든다. */
export function forgetCartId(): void {
  writeCartId(null)
}

/**
 * 이 브라우저의 장바구니를 가져오는 쿼리(cart Query Domain의 getCartQueryOptions)에 더할 옵션. 장바구니가 없거나 아직 모르면
 * 가져오지 않고, 백엔드에 없는 장바구니(404)는 다시 요청하지 않는다.
 *
 *   const cartId = useCartId()
 *   const { data: cart, error } = useQuery({ ...getCartQueryOptions(cartId ?? ''), ...currentCartQuery(cartId) })
 *   useForgetMissingCart(error)
 */
export function currentCartQuery(cartId: string | null | undefined) {
  return {
    enabled: typeof cartId === 'string',
    retry: (failureCount: number, error: Error) => !isNotFound(error) && failureCount < 3,
  }
}

/**
 * 저장한 장바구니가 백엔드에 없으면(404. 오래되어 지웠거나, 목 백엔드를 다시 띄웠거나, 다른 탭에서 주문을 마쳤을 때) 그 id를
 * 지운다. 그러면 장바구니가 없는 것으로 보이고, 다음에 담을 때 새 장바구니를 만든다.
 */
export function useForgetMissingCart(error: Error | null): void {
  const missing = isNotFound(error)
  useEffect(() => {
    if (missing) forgetCartId()
  }, [missing])
}

function writeCartId(cartId: string | null): void {
  try {
    if (cartId === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, cartId)
  } catch {
    memoryCartId = cartId
  }
  for (const listener of listeners) listener()
}

// useSyncExternalStore가 렌더링할 때마다 다시 구독하지 않도록 모듈에 하나만 둔다.
function subscribe(listener: () => void): () => void {
  // 다른 탭이 장바구니 id를 바꾸면(예: 다른 탭에서 주문을 마침) 이 탭도 따라 바꾼다. 같은 탭의 변경은 storage 이벤트가 오지 않는다.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener()
  }
  listeners.add(listener)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
