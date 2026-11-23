import type { CustomerStatus } from '../contracts';
import { avoidLines, groupLines, orderLines, vipLines } from '../data';

type Source = Pick<CustomerStatus, 'personality' | 'order' | 'avoid' | 'group' | 'vip'>;

const pick = <T>(pair: readonly [T, T], rng: () => number): T => pair[rng() < 0.5 ? 0 : 1];

/**
 * 손님이 입장할 때 한 번 말하는 대사들(GDD §주문·§특별 손님): 주문 → 빼 주세요 → 단체 → VIP 순.
 * 각각 2개 중 하나를 ui가 고른다(시드 불필요). 해당 없는 손님은 빈 배열이다.
 */
export function entryLines(c: Source, rng: () => number = Math.random): string[] {
  const lines: string[] = [];
  if (c.order) lines.push(pick(orderLines[c.order.ingredient as keyof typeof orderLines][c.order.count], rng));
  if (c.avoid) lines.push(pick(avoidLines[c.avoid as keyof typeof avoidLines], rng));
  if (c.group) lines.push(pick(groupLines[c.personality], rng));
  if (c.vip) lines.push(pick(vipLines[c.personality], rng));
  return lines;
}
