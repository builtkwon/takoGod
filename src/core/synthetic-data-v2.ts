import type { DialogueLine, Personality, TasteKind, TasteLines } from '../contracts';
import type { GameDataV2 } from './game-v2';

const PERSONALITIES: readonly Personality[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];
const KINDS: readonly TasteKind[] = ['no-filling', 'trap', 'dark', 'roll-miss', 'perfect'];

/** 시뮬레이션·테스트 전용 자리표시 맛보기 대사. 실제 대사는 src/data가 main을 거쳐 주입한다. */
export const syntheticTasteLines = Object.fromEntries(
  PERSONALITIES.map((p) => [p, Object.fromEntries(KINDS.map((k) => [k, [`${p} ${k} 0`, `${p} ${k} 1`]]))]),
) as unknown as TasteLines;

/** 시뮬레이션·테스트 전용 자리표시 데이터. 실제 대사는 src/data가 main을 거쳐 주입한다. */
export const syntheticDataV2: GameDataV2 = {
  dialogues: PERSONALITIES.flatMap((personality) =>
    Array.from(
      { length: 10 },
      (_, i): DialogueLine => ({ personality, prompt: `${personality} q${i}`, good: `good ${i}`, bad: `bad ${i}` }),
    ),
  ),
  reviewComments: (personality, bucket) => [`${personality} ${bucket}-a`, `${personality} ${bucket}-b`, `${personality} ${bucket}-c`],
  tutorialComment: 'tutorial 5 stars',
  tasteLines: syntheticTasteLines,
};
