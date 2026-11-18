// 브라우저 SessionStore(ADR 0002). core는 contracts 포트만 알고, 이 구현은 main이 조립한다.
import type { ReviewResult, SessionSnapshot, SessionStore } from './contracts';

export const SESSION_KEY = 'takoyaki:session';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const PERSONALITIES: readonly unknown[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];

/** 신뢰 경계: sessionStorage 값은 외부 입력이다. ReviewResult 필드와 타입이 맞는지 본다. */
function isReview(r: unknown): r is ReviewResult {
  if (typeof r !== 'object' || r === null) return false;
  const v = r as Record<string, unknown>;
  return (
    (v.source === 'tutorial' || v.source === 'customer') &&
    typeof v.stars === 'number' &&
    v.stars >= 0 &&
    v.stars <= 5 &&
    Number.isInteger(v.stars * 2) && // 0.5 단위. 0~1점은 0~1점 떠남(GDD §점수)
    typeof v.comment === 'string' &&
    (v.personality === null || PERSONALITIES.includes(v.personality))
  );
}

/** 읽기·쓰기 실패와 형식 불일치는 "저장값 없음"으로 다룬다(전체를 버린다). */
export function createBrowserSessionStore(storage?: StorageLike): SessionStore {
  // sessionStorage 접근 자체가 SecurityError를 던질 수 있어 try 안에서만 읽는다.
  return {
    load() {
      try {
        const v: Partial<SessionSnapshot> | null = JSON.parse((storage ?? sessionStorage).getItem(SESSION_KEY) ?? 'null');
        const ok =
          v !== null &&
          v.version === 1 &&
          typeof v.tutorialCompleted === 'boolean' &&
          typeof v.finished === 'boolean' &&
          Array.isArray(v.reviews) &&
          v.reviews.every(isReview);
        return ok ? (v as SessionSnapshot) : null;
      } catch {
        return null;
      }
    },
    save(s) {
      try {
        (storage ?? sessionStorage).setItem(SESSION_KEY, JSON.stringify(s));
      } catch {
        // 저장 불가(비공개 모드 등)여도 게임은 계속한다. 새로고침 복원만 못 한다.
      }
    },
  };
}
