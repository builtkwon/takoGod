import type { SessionSnapshot, SessionStore } from '../contracts';

/** 테스트·시뮬레이션용 메모리 저장소. 브라우저 sessionStorage 구현은 main이 조립한다. */
export function createMemorySessionStore(initial: SessionSnapshot | null = null): SessionStore {
  let value = initial;
  return {
    load: () => value,
    save: (s) => {
      value = s;
    },
  };
}
