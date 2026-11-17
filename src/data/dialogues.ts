// 손님 대사 40문항(성격당 10). 기준: docs/GDD.md §콘텐츠. 검사: pnpm tool dialogue.lint
import type { DialogueLine } from '../contracts';

export const dialogues: readonly DialogueLine[] = [
  // 급한 직장인
  { personality: 'salaryman', prompt: '빨리 되나요? 회의 5분 남았어요!', good: '금방 구워 드릴게요, 잠시만요!', bad: '회의보다 타코야끼가 중요하죠!' },
  { personality: 'salaryman', prompt: '하나만 포장해 주세요. 급해서요.', good: '네, 포장해서 바로 드릴게요!', bad: '급하면 문어한테 말하세요!' },
  { personality: 'salaryman', prompt: '카드 되나요? 현금이 없어서요.', good: '카드도 되니까 걱정 마세요!', bad: '현금 없으면 문어로 내세요!' },
  { personality: 'salaryman', prompt: '지금 줄 서 있는 분 몇 명이에요?', good: '앞에 한 분이라 금방이에요!', bad: '저는 줄 세는 법을 몰라요!' },
  { personality: 'salaryman', prompt: '소스는 따로 담아 주실 수 있죠?', good: '물론이죠, 따로 담아 드릴게요!', bad: '소스는 제 마음속에 있어요!' },
  { personality: 'salaryman', prompt: '점심시간 끝나기 전에 먹어야 해요.', good: '시간 안에 꼭 맞춰 드릴게요!', bad: '점심은 원래 천천히 먹는 거예요!' },
  { personality: 'salaryman', prompt: '아, 방금 메일 왔네. 잠깐만요.', good: '천천히 확인하세요, 기다릴게요!', bad: '메일 말고 저한테 답장하세요!' },
  { personality: 'salaryman', prompt: '여기 하루에 몇 개나 팔아요?', good: '점심엔 꽤 많이 나가요, 인기예요!', bad: '세다가 잊어버려서 처음부터예요!' },
  { personality: 'salaryman', prompt: '너무 뜨거운 건 곤란한데요...', good: '조금 식혀서 드릴게요!', bad: '뜨거운 게 인생이잖아요!' },
  { personality: 'salaryman', prompt: '이거 먹으면 오후에 힘 날까요?', good: '든든해서 오후까지 힘날 거예요!', bad: '힘 안 나면 그건 문어 탓이에요!' },

  // 수다쟁이 할머니
  { personality: 'grandma', prompt: '아이고, 우리 손주가 이거 참 좋아했는데...', good: '손주분도 좋아하실 맛이에요, 할머니!', bad: '손주는 줄 서서 사 오라 하세요!' },
  { personality: 'grandma', prompt: '내가 젊을 때는 말이야, 이게 백 원이었어.', good: '그땐 정말 싸고 맛났겠어요!', bad: '백 원 내시면 하나 드릴게요!' },
  { personality: 'grandma', prompt: '이 문어는 어디서 났누? 싱싱하구먼.', good: '아침에 들여온 싱싱한 문어예요!', bad: '바다에서 직접 낚시했어요, 제가!' },
  { personality: 'grandma', prompt: '날씨가 참 좋지? 이런 날은 걷기 좋아.', good: '네, 산책하다 들르시기 좋죠!', bad: '날씨는 모르겠고 문어는 압니다!' },
  { personality: 'grandma', prompt: '아가씨, 이거 몇 개 들었수?', good: '한 판에 여섯 개 들었어요!', bad: '세 보세요, 그게 재미예요!' },
  { personality: 'grandma', prompt: '내 무릎이 안 좋은데, 의자 있수?', good: '여기 앉으세요, 편히 쉬세요!', bad: '무릎 대신 문어를 믿으세요!' },
  { personality: 'grandma', prompt: '이 가게 생긴 지 오래됐나?', good: '네, 오랫동안 단골분이 많아요!', bad: '어제 막 땅에서 솟아났어요!' },
  { personality: 'grandma', prompt: '우리 영감은 매운 걸 좋아했지.', good: '매운 소스도 따로 준비돼 있어요!', bad: '영감님 얘기는 소스에 넣을게요!' },
  { personality: 'grandma', prompt: '하나 먹어 봐도 되려나? 맛 좀 보게.', good: '그럼요, 하나 맛보고 가세요!', bad: '맛보려면 전 재산이 필요해요!' },
  { personality: 'grandma', prompt: '거스름돈은 됐으니 하나 더 줘요.', good: '감사해요, 하나 더 드릴게요!', bad: '그 돈으론 문어 다리도 못 사요!' },

  // 까다로운 미식가
  { personality: 'gourmet', prompt: '가쓰오부시는 어떤 걸 쓰시나요?', good: '향이 진한 걸로 골라 쓰고 있어요!', bad: '가쓰오는 몰라도 기분은 알아요!' },
  { personality: 'gourmet', prompt: '반죽 숙성은 몇 시간 하셨죠?', good: '하루 동안 차갑게 숙성했어요!', bad: '저는 반죽이랑 같이 자요!' },
  { personality: 'gourmet', prompt: '겉은 바삭, 속은 촉촉해야 합니다.', good: '바삭촉촉하게 구워 드릴게요!', bad: '촉촉한 건 제 눈물뿐이에요!' },
  { personality: 'gourmet', prompt: '문어는 어느 산지 겁니까?', good: '근해에서 잡은 걸 쓰고 있어요!', bad: '문어 본인이 말 안 해주던데요!' },
  { personality: 'gourmet', prompt: '소스 단맛이 너무 강하진 않나요?', good: '단맛은 줄이고 감칠맛을 살렸어요!', bad: '단맛은 제 인생에서 뺐어요!' },
  { personality: 'gourmet', prompt: '혹시 마요네즈 직접 만드시나요?', good: '네, 매일 아침 직접 만들어요!', bad: '마요네즈가 저를 만들었어요!' },
  { personality: 'gourmet', prompt: '이 철판 온도는 몇 도죠?', good: '적정 온도로 늘 맞춰 두고 있어요!', bad: '저도 몰라요, 뜨거우면 맞아요!' },
  { personality: 'gourmet', prompt: '모양이 균일하지 않군요.', good: '다음엔 더 둥글게 굴릴게요!', bad: '울퉁불퉁한 게 개성이에요!' },
  { personality: 'gourmet', prompt: '파래 가루가 너무 많지 않나요?', good: '적게 올려서 다시 드릴게요!', bad: '치아에 끼는 맛으로 먹어요!' },
  { personality: 'gourmet', prompt: '솔직히 평점을 매기자면요...', good: '솔직한 평가 기대할게요!', bad: '평점은 이미 제가 줬어요!' },

  // 외국인 관광객
  { personality: 'tourist', prompt: '이거 이름이 뭐예요? 처음 봐요!', good: '타코야끼예요, 문어 들어갔어요!', bad: '저도 이름은 까먹었어요!' },
  { personality: 'tourist', prompt: '문어? 정말 먹어도 괜찮아요?', good: '네, 부드럽고 맛있어요!', bad: '문어가 먼저 물 수도 있어요!' },
  { personality: 'tourist', prompt: '사진 찍어도 돼요? 너무 귀여워요.', good: '그럼요, 예쁘게 찍어 가세요!', bad: '사진값은 따로 받아요, 하하!' },
  { personality: 'tourist', prompt: '매운 거 없어요? 약간 매운 거요.', good: '매운 소스 살짝 올려 드릴게요!', bad: '매운 건 제 농담뿐이에요!' },
  { personality: 'tourist', prompt: '이거 한국 전통 음식이에요?', good: '일본에서 왔지만 한국서도 인기예요!', bad: '네, 세종대왕이 처음 구우셨어요!' },
  { personality: 'tourist', prompt: 'How much? 얼마예요?', good: '가격은 메뉴판에 있어요!', bad: '가격은 비밀이에요, 쉿!' },
  { personality: 'tourist', prompt: '어떻게 먹는 거예요? 젓가락이요?', good: '꼬치로 콕 찍어 드세요!', bad: '일단 손으로 던져 보세요!' },
  { personality: 'tourist', prompt: '한국에 와서 처음 먹어요!', good: '환영해요, 맛있게 드세요!', bad: '처음이라 문어도 긴장했대요!' },
  { personality: 'tourist', prompt: '이거 뜨거워요? 입 데이면 어쩌죠?', good: '호호 불어서 천천히 드세요!', bad: '데이면 관광 기념이죠!' },
  { personality: 'tourist', prompt: '친구한테 추천할게요, 맛있어요!', good: '정말 고마워요, 또 오세요!', bad: '추천은 사양, 줄 길어져요!' },
];
