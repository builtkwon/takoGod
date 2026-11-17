import type { DialogueLine, Personality } from '../contracts';
import type { GameData } from './game';

const PERSONALITIES: readonly Personality[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];

/** 시뮬레이션·테스트 전용 자리표시 데이터. 실제 대사는 src/data가 main을 거쳐 주입한다. */
export const syntheticData: GameData = {
  dialogues: PERSONALITIES.flatMap((personality) =>
    Array.from(
      { length: 10 },
      (_, i): DialogueLine => ({ personality, prompt: `${personality} q${i}`, good: `good ${i}`, bad: `bad ${i}` }),
    ),
  ),
  reviewComments: (personality, bucket) => [`${personality} ${bucket}-a`, `${personality} ${bucket}-b`, `${personality} ${bucket}-c`],
  tutorialComment: 'tutorial 5 stars',
};
