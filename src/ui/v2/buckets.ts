import { el } from '../dom';
import type { BucketSource, Controller, Pt } from './controller';

export interface Buckets {
  readonly margarine: HTMLElement;
  readonly batter: HTMLElement;
  origin(kind: 'margarine' | 'batter'): Pt | null;
}

const center = (e: HTMLElement): Pt | null => {
  const r = e.getBoundingClientRect();
  return r.width === 0 && r.height === 0 ? null : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** 마가린 통(철판 왼쪽)·반죽 주전자(오른쪽). 눌러서 구멍으로 끌어 놓는다. */
export function createBuckets(controller: Controller): Buckets {
  const make = (kind: 'margarine' | 'batter', label: string): HTMLElement => {
    const e = el('div', `ui-bucket ui-bucket-${kind} ui-hit`, label);
    e.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation(); // 장면 쪽 pointerdown(root)과 겹치지 않게
      const origin = center(e);
      const source: BucketSource = { material: { kind }, origin: origin ?? { x: ev.clientX, y: ev.clientY } };
      controller.down(ev.pointerId, { x: ev.clientX, y: ev.clientY }, source);
    });
    return e;
  };
  const margarine = make('margarine', '버터');
  const batter = make('batter', '반죽');
  return { margarine, batter, origin: (k) => center(k === 'margarine' ? margarine : batter) };
}
