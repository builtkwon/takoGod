// 브라우저 BestScoreStore(ADR 0004). core는 contracts 포트만 알고, 이 구현은 main이 조립한다.
import type { BestScoreStore } from './contracts';

export const BEST_KEY = 'takoyaki:best';

export type BestStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 값이 없으면 null. 손상 값(파싱 실패, version 불일치, best가 유한한 0 이상 정수 아님)은 null을 돌려주고 키를 지운다. 접근·쓰기 실패는 무시한다. */
export function createBrowserBestStore(storage?: BestStorageLike): BestScoreStore {
  return {
    load() {
      try {
        const s = storage ?? localStorage; // 접근 자체가 SecurityError를 던질 수 있어 try 안에서 읽는다.
        const raw = s.getItem(BEST_KEY);
        if (raw === null) return null;
        try {
          const v: { version?: unknown; best?: unknown } | null = JSON.parse(raw);
          if (v !== null && typeof v === 'object' && v.version === 1 && typeof v.best === 'number' && Number.isSafeInteger(v.best) && v.best >= 0) return v.best;
        } catch {
          // 파싱 실패는 아래에서 손상 값으로 처리한다.
        }
        s.removeItem(BEST_KEY);
        return null;
      } catch {
        return null;
      }
    },
    save(best) {
      try {
        (storage ?? localStorage).setItem(BEST_KEY, JSON.stringify({ version: 1, best }));
      } catch {
        // 쿼터 초과·비활성이어도 게임은 계속한다. 최고 기록만 남기지 못한다.
      }
    },
  };
}
