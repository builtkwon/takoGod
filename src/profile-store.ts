// 브라우저 프로필 저장(ADR 0005): 튜토리얼 완료 여부만 localStorage에 둔다. core는 모르고, main이 세션 저장 포트를 감싸 쓴다.
import type { SessionStore } from './contracts';

export const PROFILE_KEY = 'takoyaki:profile';

export type ProfileStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface ProfileStore {
  load(): { tutorialCompleted: boolean } | null;
  markTutorialCompleted(): void;
}

/** 값이 없으면 null. 손상 값(파싱 실패, version 불일치, tutorialCompleted가 true 아님)은 null을 돌려주고 키를 지운다. 접근·쓰기 실패는 무시한다. */
export function createBrowserProfileStore(storage?: ProfileStorageLike): ProfileStore {
  return {
    load() {
      try {
        const s = storage ?? localStorage; // 접근 자체가 SecurityError를 던질 수 있어 try 안에서 읽는다.
        const raw = s.getItem(PROFILE_KEY);
        if (raw === null) return null;
        try {
          const v: { version?: unknown; tutorialCompleted?: unknown } | null = JSON.parse(raw);
          if (v !== null && typeof v === 'object' && v.version === 1 && v.tutorialCompleted === true) return { tutorialCompleted: true };
        } catch {
          // 파싱 실패는 아래에서 손상 값으로 처리한다.
        }
        s.removeItem(PROFILE_KEY);
        return null;
      } catch {
        return null;
      }
    },
    markTutorialCompleted() {
      try {
        (storage ?? localStorage).setItem(PROFILE_KEY, JSON.stringify({ version: 1, tutorialCompleted: true }));
      } catch {
        // 쿼터 초과·비활성이어도 게임은 계속한다. 기억만 못 한다.
      }
    },
  };
}

/** 세션 저장 포트를 감싼다: 세션 값이 없고 프로필이 완료면 튜토리얼 없이 P1부터(리뷰 없음), save가 완료를 받으면 프로필에도 기록한다. */
export function withProfile(session: SessionStore, profile: ProfileStore): SessionStore {
  return {
    load() {
      return session.load() ?? (profile.load()?.tutorialCompleted ? { version: 1, tutorialCompleted: true, finished: false, reviews: [] } : null);
    },
    save(s) {
      session.save(s);
      if (s.tutorialCompleted) profile.markTutorialCompleted();
    },
  };
}
