import type { EventBus, ScenePicker } from '../../contracts';
import type { Effects } from './effects';

/** 헛손질·굴리기 결과 표시. 판정은 core 이벤트 그대로 보여 준다. */
export function bindFeedback(bus: EventBus, picker: ScenePicker, fx: Pick<Effects, 'mark'>): () => void {
  const markAt = (hole: number, text: string, tone: 'good' | 'bad' | 'neutral'): void => {
    const p = picker.anchor({ kind: 'hole', index: hole });
    if (p) fx.mark(text, p, tone);
  };
  const offs = [
    bus.on('cook/tap-ignored', ({ hole }) => markAt(hole, '헛손질', 'neutral')),
    bus.on('cook/rolled', ({ hole, hit }) => (hit ? markAt(hole, '적중!', 'good') : markAt(hole, '빗나감', 'bad'))),
  ];
  return () => offs.forEach((off) => off());
}
