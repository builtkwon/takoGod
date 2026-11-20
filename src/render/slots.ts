/** 손님 id를 모델 자리에 고정한다. 남은 손님은 자리를 지키고 새 손님은 빈 자리로 간다(자리가 모자라면 무시). */
export function assignSlots(prev: readonly (string | null)[], ids: readonly string[]): (string | null)[] {
  const next = prev.map((id) => (id !== null && ids.includes(id) ? id : null));
  for (const id of ids) {
    if (next.includes(id)) continue;
    const free = next.indexOf(null);
    if (free >= 0) next[free] = id;
  }
  return next;
}
