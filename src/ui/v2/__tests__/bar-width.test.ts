// 타이밍 바 폭은 화면 폭과 무관하게 고정(320px), 좁은 화면만 좌우 16px 여백. 영역·마커는 트랙 기준 %.
import { describe, expect, it } from 'vitest';
import { BAR_MARGIN, BAR_W, CSS_V2 } from '../styles';

describe('타이밍 바 고정 폭', () => {
  it('상수는 320px·여백 16px', () => {
    expect([BAR_W, BAR_MARGIN]).toEqual([320, 16]);
  });
  it('.ui-bar 스타일이 min(320px, 칸 폭 - 32px) 가운데 정렬이고 높이 44px', () => {
    const rule = CSS_V2.split('\n').find((l) => l.startsWith('.ui-bar{'))!;
    expect(rule).toContain('width:min(320px,calc(100% - 32px))');
    expect(rule).toContain('margin:0 auto');
    expect(rule).toContain('height:44px');
  });
});
