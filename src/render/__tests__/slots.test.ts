import { describe, expect, it } from 'vitest';
import { DataTexture } from 'three';
import { assignSlots } from '../slots';
import { setMap, toon } from '../toon';

describe('assignSlots', () => {
  it('앞 손님이 나가도 남은 손님은 자리를 지키고 새 손님은 빈 자리로 간다', () => {
    let s = assignSlots([null, null], ['a', 'b']);
    expect(s).toEqual(['a', 'b']);
    s = assignSlots(s, ['b']);
    expect(s).toEqual([null, 'b']);
    s = assignSlots(s, ['b', 'c']);
    expect(s).toEqual(['c', 'b']);
  });
});

describe('setMap', () => {
  it('map이 바뀔 때만 재컴파일(version 증가)한다', () => {
    const m = toon(null);
    const v0 = m.version;
    const t = new DataTexture(new Uint8Array(4), 1, 1);
    setMap(m, t);
    expect(m.version).toBe(v0 + 1);
    setMap(m, t);
    expect(m.version).toBe(v0 + 1);
    setMap(m, null);
    expect(m.version).toBe(v0 + 2);
  });
});
