import { describe, expect, it } from 'vitest';
import type { SessionSnapshot } from '../../contracts';
import { createMemorySessionStore } from '../session';

const snap: SessionSnapshot = { version: 1, tutorialCompleted: true, finished: false, reviews: [] };

describe('메모리 SessionStore', () => {
  it('비어 있으면 null', () => {
    expect(createMemorySessionStore().load()).toBeNull();
  });

  it('save한 값을 load한다', () => {
    const s = createMemorySessionStore();
    s.save(snap);
    expect(s.load()).toEqual(snap);
  });

  it('초기값을 받을 수 있다', () => {
    expect(createMemorySessionStore(snap).load()).toEqual(snap);
  });
});
