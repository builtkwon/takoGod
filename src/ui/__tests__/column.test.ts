import { describe, expect, it } from 'vitest';
import { columnOf } from '../column';

describe('columnOf', () => {
  it('캔버스가 없으면 layer 전체', () => {
    expect(columnOf({ left: 0, width: 390 }, null)).toEqual({ left: 0, width: 390 });
  });
  it('1280 폭에서 가운데 600 캔버스 → left 340 width 600', () => {
    expect(columnOf({ left: 0, width: 1280 }, { left: 340, width: 600 })).toEqual({ left: 340, width: 600 });
  });
  it('캔버스가 layer와 같으면 전체, layer 밖으로 나가면 자른다', () => {
    expect(columnOf({ left: 0, width: 390 }, { left: 0, width: 390 })).toEqual({ left: 0, width: 390 });
    expect(columnOf({ left: 10, width: 300 }, { left: -20, width: 400 })).toEqual({ left: 0, width: 300 });
  });
  it('폭 0이거나 겹치지 않으면 layer 전체', () => {
    expect(columnOf({ left: 0, width: 300 }, { left: 50, width: 0 })).toEqual({ left: 0, width: 300 });
    expect(columnOf({ left: 0, width: 300 }, { left: 400, width: 100 })).toEqual({ left: 0, width: 300 });
  });
});
