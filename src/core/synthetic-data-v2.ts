import type { Personality, TasteKind, TasteLines } from '../contracts';
import type { GameDataV2 } from './game-v2';
import { syntheticData } from './synthetic-data';

const PERSONALITIES: readonly Personality[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];
const KINDS: readonly TasteKind[] = ['no-filling', 'trap', 'dark', 'roll-miss', 'perfect'];

/** 시뮬레이션·테스트 전용 자리표시 맛보기 대사. 실제 대사는 src/data가 main을 거쳐 주입한다. */
export const syntheticTasteLines = Object.fromEntries(
  PERSONALITIES.map((p) => [p, Object.fromEntries(KINDS.map((k) => [k, [`${p} ${k} 0`, `${p} ${k} 1`]]))]),
) as unknown as TasteLines;

export const syntheticDataV2: GameDataV2 = { ...syntheticData, tasteLines: syntheticTasteLines };
