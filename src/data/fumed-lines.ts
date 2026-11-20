// 분노 대사(인내 100%): 성격 4 × 2개 = 8개. 짧고 웃기게, 혐오·비하 없이. 기준: docs/GDD.md §손님 대화, §콘텐츠
import type { Personality } from '../contracts';

export const fumedLines: Readonly<Record<Personality, readonly [string, string]>> = {
  salaryman: ['점심시간 끝나요, 빨리요!', '제 타코야끼는 아직도 반죽인가요!'],
  grandma: ['아이고 내 다리야, 언제 나오누!', '기다리다 손주 대학 가겠네!'],
  gourmet: ['기다림은 최고의 양념이 아닙니다.', '이 정도면 숙성이 아니라 방치입니다.'],
  tourist: ['Hurry up! 비행기 놓쳐요!', '내 배꼽시계가 파업했어요!'],
};
