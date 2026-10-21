import type { ListMembersParams } from '@/shared/api/generated/model'

// members Query Domain(OpenAPI tag `members`)의 쿼리 키. 위 단계의 키로 아래 단계를 한꺼번에 무효화할 수 있게
// ['members'] → ['members', <operationId>] → ['members', <operationId>, ...인자]처럼 계층으로 만든다.
export const membersKeys = {
  all: ['members'] as const,
  listMembers: (params: ListMembersParams) => [...membersKeys.all, 'listMembers', params] as const,
}
