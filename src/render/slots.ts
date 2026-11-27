/**
 * 손님 id를 모델 자리에 고정한다. 남은 손님은 자리를 지키고 새 손님은 빈 자리(인덱스 < seatCount)로 간다(자리가 모자라면 무시).
 * seatCount가 늘어도 기존 인덱스는 그대로라 기존 손님은 자리를 유지한다(위치는 seatPositions가 새로 펼친다).
 */
export function assignSlots(prev: readonly (string | null)[], ids: readonly string[], seatCount: number = prev.length): (string | null)[] {
  const next = prev.map((id, i) => (id !== null && i < seatCount && ids.includes(id) ? id : null));
  for (const id of ids) {
    if (next.includes(id)) continue;
    const free = next.findIndex((x, i) => x === null && i < seatCount);
    if (free >= 0) next[free] = id;
  }
  return next;
}
