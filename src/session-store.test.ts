// 원본: docs/adr/0002-session-storage.md, docs/GDD.md §제품
import { describe, expect, it } from 'vitest';
import type { SessionSnapshot } from './contracts';
import { SESSION_KEY, createBrowserSessionStore, type StorageLike } from './session-store';

const snap: SessionSnapshot = {
  version: 1,
  tutorialCompleted: true,
  finished: false,
  reviews: [
    { source: 'tutorial', stars: 5, comment: '좋아요', personality: null },
    { source: 'customer', stars: 3.5, comment: '무난', personality: 'gourmet' },
  ],
};

function stub(raw: string | null): StorageLike & { saved: Record<string, string> } {
  const saved: Record<string, string> = {};
  return {
    saved,
    getItem: (k) => (k === SESSION_KEY ? raw : null),
    setItem: (k, v) => {
      saved[k] = v;
    },
  };
}

const load = (raw: string | null) => createBrowserSessionStore(stub(raw)).load();
const withReviews = (reviews: unknown) => JSON.stringify({ ...snap, reviews });

describe('SessionStore.load (ADR 0002 §결정 6)', () => {
  it('정상 값은 그대로 돌려준다', () => {
    expect(load(JSON.stringify(snap))).toEqual(snap);
  });

  it('저장값이 없으면 null이다', () => {
    expect(load(null)).toBeNull();
  });

  it('손상된 JSON은 null이다', () => {
    expect(load('{not json')).toBeNull();
  });

  it('version이 1이 아니면 null이다', () => {
    expect(load(JSON.stringify({ ...snap, version: 2 }))).toBeNull();
  });

  it('필드 타입이 틀리면 null이다', () => {
    expect(load(JSON.stringify({ ...snap, finished: 'yes' }))).toBeNull();
    expect(load(JSON.stringify({ ...snap, tutorialCompleted: 1 }))).toBeNull();
    expect(load(JSON.stringify({ ...snap, reviews: 'x' }))).toBeNull();
  });

  it('reviews에 null 원소가 있으면 전체를 버린다', () => {
    expect(load(withReviews([null]))).toBeNull();
  });

  it('stars가 유한 숫자가 아니면 전체를 버린다', () => {
    // JSON은 NaN을 표현하지 못해 null로 직렬화된다. 문자열 숫자도 거부한다.
    expect(load(withReviews([{ ...snap.reviews[0], stars: Number.NaN }]))).toBeNull();
    expect(load(withReviews([{ ...snap.reviews[0], stars: '5' }]))).toBeNull();
  });

  it('알 수 없는 source·personality는 전체를 버린다', () => {
    expect(load(withReviews([{ ...snap.reviews[0], source: 'x' }]))).toBeNull();
    expect(load(withReviews([{ ...snap.reviews[1], personality: 'alien' }]))).toBeNull();
  });

  it('stars는 1~5 범위의 0.5 단위만 허용한다(GDD §점수)', () => {
    for (const stars of [0, 0.5, 5.5, 6, 3.3]) expect(load(withReviews([{ ...snap.reviews[1], stars }]))).toBeNull();
    for (const stars of [1, 2.5, 5]) expect(load(withReviews([{ ...snap.reviews[1], stars }]))).not.toBeNull();
  });

  it('sessionStorage 접근 자체가 던져도(쿠키 차단·opaque origin) 생성·load·save가 멈추지 않는다', () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    try {
      const store = createBrowserSessionStore();
      expect(store.load()).toBeNull();
      expect(() => store.save(snap)).not.toThrow();
    } finally {
      if (desc) Object.defineProperty(globalThis, 'sessionStorage', desc);
      else delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });

  it('getItem이 던지면 null이다', () => {
    const s: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => undefined,
    };
    expect(createBrowserSessionStore(s).load()).toBeNull();
  });
});

describe('SessionStore.save', () => {
  it('키 takoyaki:session에 JSON으로 쓴다', () => {
    const s = stub(null);
    createBrowserSessionStore(s).save(snap);
    expect(JSON.parse(s.saved[SESSION_KEY] ?? 'null')).toEqual(snap);
  });

  it('setItem이 던져도 예외를 밖으로 내지 않는다', () => {
    const s: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => createBrowserSessionStore(s).save(snap)).not.toThrow();
  });
});
