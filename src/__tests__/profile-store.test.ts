// 원본: docs/adr/0005-profile-storage.md, docs/GDD.md §튜토리얼
import { describe, expect, it } from 'vitest';
import type { SessionSnapshot, SessionStore } from '../contracts';
import { PROFILE_KEY, createBrowserProfileStore, withProfile, type ProfileStorageLike, type ProfileStore } from '../profile-store';

function stub(raw: string | null): ProfileStorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (raw !== null) data.set(PROFILE_KEY, raw);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const load = (raw: string | null) => {
  const s = stub(raw);
  return { value: createBrowserProfileStore(s).load(), s };
};

describe('ProfileStore', () => {
  it('정상 값은 tutorialCompleted true를 돌려준다', () => {
    expect(load('{"version":1,"tutorialCompleted":true}').value).toEqual({ tutorialCompleted: true });
  });

  it('값이 없으면 null이고 아무것도 지우지 않는다', () => {
    expect(load(null).value).toBeNull();
  });

  it.each(['not json', 'null', '{"version":2,"tutorialCompleted":true}', '{"version":1,"tutorialCompleted":false}', '{"version":1}'])(
    '손상 값 %s은 null이고 키를 지운다',
    (raw) => {
      const { value, s } = load(raw);
      expect(value).toBeNull();
      expect(s.data.has(PROFILE_KEY)).toBe(false);
    },
  );

  it('markTutorialCompleted는 {version:1,tutorialCompleted:true}를 쓴다', () => {
    const s = stub(null);
    createBrowserProfileStore(s).markTutorialCompleted();
    expect(JSON.parse(s.data.get(PROFILE_KEY) as string)).toEqual({ version: 1, tutorialCompleted: true });
  });

  it('접근·쓰기 실패는 던지지 않는다', () => {
    const broken: ProfileStorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    const p = createBrowserProfileStore(broken);
    expect(p.load()).toBeNull();
    expect(() => p.markTutorialCompleted()).not.toThrow();
  });
});

describe('withProfile', () => {
  const snap = (tutorialCompleted: boolean, reviews: SessionSnapshot['reviews'] = []): SessionSnapshot => ({ version: 1, tutorialCompleted, finished: false, reviews });
  const fakes = (session: SessionSnapshot | null, completed: boolean) => {
    const saved: SessionSnapshot[] = [];
    let marked = 0;
    const store: SessionStore = { load: () => session, save: (s) => void saved.push(s) };
    const profile: ProfileStore = { load: () => (completed ? { tutorialCompleted: true } : null), markTutorialCompleted: () => void marked++ };
    return { wrapped: withProfile(store, profile), saved, marked: () => marked };
  };

  it('세션 값이 없고 프로필이 완료면 튜토리얼 없는 스냅샷(리뷰 없음)을 돌려준다', () => {
    expect(fakes(null, true).wrapped.load()).toEqual({ version: 1, tutorialCompleted: true, finished: false, reviews: [] });
  });

  it('세션 값이 있으면 프로필보다 세션 값이 우선한다', () => {
    const s = snap(false);
    expect(fakes(s, true).wrapped.load()).toBe(s);
  });

  it('둘 다 없으면 null이다', () => {
    expect(fakes(null, false).wrapped.load()).toBeNull();
  });

  it('save는 세션에 저장하고 tutorialCompleted true면 프로필에도 기록한다', () => {
    const f = fakes(null, false);
    f.wrapped.save(snap(false));
    expect(f.marked()).toBe(0);
    f.wrapped.save(snap(true));
    expect(f.saved).toHaveLength(2);
    expect(f.marked()).toBe(1);
  });
});
