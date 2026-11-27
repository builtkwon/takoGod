// 원본: docs/adr/0004-best-shop-score-storage.md, docs/GDD.md §가게 점수
import { describe, expect, it } from 'vitest';
import { BEST_KEY, createBrowserBestStore, type BestStorageLike } from '../best-store';

function stub(raw: string | null): BestStorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (raw !== null) data.set(BEST_KEY, raw);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const load = (raw: string | null) => {
  const s = stub(raw);
  return { value: createBrowserBestStore(s).load(), s };
};

describe('BestScoreStore.load', () => {
  it('정상 값은 best를 돌려준다(0 포함)', () => {
    expect(load('{"version":1,"best":1234}').value).toBe(1234);
    expect(load('{"version":1,"best":0}').value).toBe(0);
  });

  it('값이 없으면 null이고 아무것도 지우지 않는다', () => {
    expect(load(null).value).toBeNull();
  });

  it.each([
    ['파싱 실패', '{not json'],
    ['JSON null', 'null'],
    ['version 불일치', '{"version":2,"best":10}'],
    ['version 없음', '{"best":10}'],
    ['best 문자열', '{"version":1,"best":"10"}'],
    ['best 음수', '{"version":1,"best":-1}'],
    ['best 소수', '{"version":1,"best":1.5}'],
    ['best 안전 정수 초과', '{"version":1,"best":9007199254740993}'],
    ['best 없음','{"version":1}'],
    ['best null(NaN·Infinity 직렬화)', '{"version":1,"best":null}'],
  ])('손상 값(%s)은 null이고 키를 지운다', (_n, raw) => {
    const { value, s } = load(raw);
    expect(value).toBeNull();
    expect(s.data.has(BEST_KEY)).toBe(false);
  });

  it('localStorage 접근이 throw해도 null이다', () => {
    const boom = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(createBrowserBestStore(boom).load()).toBeNull();
  });

  it('손상 값 삭제가 throw해도 null이다', () => {
    const s = { ...stub('x'), removeItem: () => { throw new Error('x'); } };
    expect(createBrowserBestStore(s).load()).toBeNull();
  });
});

describe('BestScoreStore.save', () => {
  it('{version:1,best}로 저장한다', () => {
    const s = stub(null);
    createBrowserBestStore(s).save(777);
    expect(JSON.parse(s.data.get(BEST_KEY) ?? 'null')).toEqual({ version: 1, best: 777 });
  });

  it('저장한 값을 load가 읽는다', () => {
    const store = createBrowserBestStore(stub(null));
    store.save(55);
    expect(store.load()).toBe(55);
  });

  it('쿼터 초과 등 setItem 실패는 무시한다', () => {
    const s = {
      ...stub(null),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => createBrowserBestStore(s).save(1)).not.toThrow();
  });
});
