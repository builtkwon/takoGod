// 튜토리얼 안내문구 9개(굽기 단계별). 기준: docs/GDD.md §튜토리얼, §콘텐츠
import type { TutorialStep } from '../contracts';

export const tutorialSteps: readonly TutorialStep[] = [
  { target: 'margarine', message: '철판 구멍에 마가린을 발라요!' },
  { target: 'batter', message: '반죽물을 부어 구멍을 채워요!' },
  { target: 'cook-1', message: '게이지가 알맞게 찼을 때 눌러요!' },
  { target: 'filling', message: '속재료 트레이에서 문어를 넣어요!' },
  { target: 'cook-2', message: '한 번 더, 알맞게 익었을 때 눌러요!' },
  { target: 'roll-1', message: '첫 번째 굴리기! 타이밍에 맞춰 눌러요!' },
  { target: 'roll-2', message: '두 번째 굴리기예요, 한 번 더!' },
  { target: 'roll-3', message: '마지막 굴리기! 동그랗게 만들어요!' },
  { target: 'done', message: '완성이에요! 손님께 내어 드려요!' },
];
