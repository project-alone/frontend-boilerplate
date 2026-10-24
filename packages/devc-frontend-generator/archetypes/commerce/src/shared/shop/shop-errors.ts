import { apiErrorMessage, isApiError } from '@/shared/api/api-fetch'
import { ShopError } from '@/shared/api/generated/model'

// 커머스 Archetype: 장바구니·주문 operation이 실패한 응답을 화면이 다루기 쉽게 바꾼다.

/**
 * 실패한 이유. 백엔드가 명세의 ShopError로 알린 이유(예: 재고 부족)를 쓰고, 이유가 없으면(네트워크 오류 등) 다시 시도하라고
 * 안내한다.
 */
export function shopFailureReason(error: Error): string {
  return apiErrorMessage(error, ShopError) ?? '잠시 뒤에 다시 시도해 주세요.'
}

/** 백엔드가 찾는 장바구니·주문·상품이 없다고(404) 답했는가 */
export function isNotFound(error: Error | null): boolean {
  return isApiError(error, 404)
}
