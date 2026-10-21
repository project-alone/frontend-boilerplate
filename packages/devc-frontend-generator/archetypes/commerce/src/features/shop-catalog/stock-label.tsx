// 남은 재고가 이 수 이하이면 남은 수량을 알린다.
const LOW_STOCK = 5

/**
 * 재고 안내. 품절이면 "품절", 얼마 남지 않았으면 남은 수량을 보여 주고, 넉넉하면 아무것도 보이지 않는다. 미리 렌더링한 화면(ISR)의
 * 재고라 늦을 수 있으므로, 담을 수 있는지는 장바구니에 담을 때 백엔드가 다시 확인한다.
 */
export function StockLabel({ stock }: Readonly<{ stock: number }>) {
  if (stock === 0) return <p className="text-sm font-semibold text-danger">품절</p>
  if (stock <= LOW_STOCK) return <p className="text-sm text-muted-foreground">{`남은 수량 ${String(stock)}개`}</p>
  return null
}
