// 연출 이펙트(폭죽·물음표/빠직·화면 흔들림). 판정과 무관한 연출이라 Math.random을 써도 되고, seed를 주면 같은 모양이 나온다(스냅샷용).
import { BoxGeometry, Color, CylinderGeometry, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, OctahedronGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { BufferGeometry, Camera, Scene, ShaderMaterial } from 'three';
import { CUSTOMER_POS } from './layout';
import { merge, part } from './models';
import { addOutline, toon } from './toon';

export type EffectKind = 'firework' | 'confused' | 'fumed';
export type MarkKind = 'question' | 'anger';

export interface EffectOptions {
  /** 시작 시각(ms, renderV2의 nowMs와 같은 시계). 기본은 effect()를 부른 시점의 performance.now(). */
  readonly startMs?: number | undefined;
  /** 난수 시드. 없으면 Math.random. */
  readonly seed?: number | undefined;
  /** confused에서 표시를 고정한다. 없으면 무작위. */
  readonly mark?: MarkKind | undefined;
}

/** 이펙트 길이(초). GDD §손님 대화: 폭죽 약 1초, 물음표·빠직 1.5초, 화면 흔들림 0.4초. */
export const DURATION = { firework: 1, confused: 1.5, fumed: 1.2, shake: 0.4 } as const;
const PARTICLES = 28;
const PALETTE = [0xffd23f, 0xff6b9a, 0x6bd9ff, 0x9dff6b, 0xffffff];
const HEAD_Y = 2.3;

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 노란 물음표(XY 평면에 선다). */
function questionGeo(): BufferGeometry {
  return merge([
    part(new TorusGeometry(0.1, 0.038, 5, 10, Math.PI * 1.5), 0xffd23f, [0, 0.2, 0], [1, 1, 1], [0, 0, -Math.PI * 0.25]),
    part(new CylinderGeometry(0.038, 0.038, 0.1, 5), 0xffd23f, [0.0, 0.07, 0]),
    part(new SphereGeometry(0.05, 6, 4), 0xffd23f, [0, -0.06, 0]),
  ]);
}

/** 빨간 분노 마크(💢): 가운데를 비우고 네 모서리에 ㄱ자 조각. */
function angerGeo(): BufferGeometry {
  const ps: BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ps.push(part(new BoxGeometry(0.15, 0.045, 0.045), 0xff3b30, [sx * 0.12, sy * 0.06, 0]));
      ps.push(part(new BoxGeometry(0.045, 0.15, 0.045), 0xff3b30, [sx * 0.06, sy * 0.12, 0]));
    }
  }
  return merge(ps);
}

interface Active {
  readonly kind: EffectKind;
  readonly slot: number;
  readonly start: number;
  readonly mark: MarkKind;
  /** firework: 입자 속도(x,y,z) 반복. */
  readonly vel: readonly number[];
}

export interface Effects {
  trigger(kind: EffectKind, slot: number, nowMs: number, opts?: EffectOptions): void;
  /** nowMs 기준으로 장면을 갱신하고 카메라 흔들림 오프셋(x,y)을 돌려준다. */
  update(nowMs: number): readonly [number, number];
}

export function createEffects(scene: Scene, camera: Camera, outline: ShaderMaterial): Effects {
  const qGeo = questionGeo();
  const aGeo = angerGeo();
  const slots = CUSTOMER_POS.map((p) => {
    const mk = (geo: BufferGeometry) => {
      const m = addOutline(new Mesh(geo, toon()), outline);
      m.visible = false;
      scene.add(m);
      return m;
    };
    const fw = new InstancedMesh(new OctahedronGeometry(1, 0), new MeshBasicMaterial(), PARTICLES);
    fw.frustumCulled = false;
    fw.visible = false;
    for (let i = 0; i < PARTICLES; i++) fw.setColorAt(i, new Color(PALETTE[i % PALETTE.length]!));
    scene.add(fw);
    return { p, fw, question: mk(qGeo), anger: mk(aGeo) };
  });
  const active: Active[] = [];
  const dummy = new Object3D();

  return {
    trigger(kind, slot, nowMs, opts = {}) {
      const rng = opts.seed === undefined ? Math.random : mulberry(opts.seed);
      const vel: number[] = [];
      if (kind === 'firework') {
        for (let i = 0; i < PARTICLES; i++) {
          const a = rng() * Math.PI * 2;
          const up = 0.4 + rng() * 0.9;
          const sp = 0.9 + rng() * 1.1;
          vel.push(Math.cos(a) * sp, up * 1.8, Math.sin(a) * sp * 0.5);
        }
      }
      const mark = opts.mark ?? (rng() < 0.5 ? 'question' : 'anger');
      const i = active.findIndex((e) => e.kind === kind && e.slot === slot);
      if (i >= 0) active.splice(i, 1);
      active.push({ kind, slot, start: opts.startMs ?? nowMs, mark: kind === 'fumed' ? 'anger' : mark, vel });
    },
    update(nowMs) {
      for (const s of slots) {
        s.fw.visible = false;
        s.question.visible = false;
        s.anger.visible = false;
      }
      let shake: [number, number] = [0, 0];
      for (let n = active.length - 1; n >= 0; n--) {
        const e = active[n]!;
        const t = (nowMs - e.start) / 1000;
        const dur = DURATION[e.kind];
        if (t > dur) {
          active.splice(n, 1);
          continue;
        }
        if (t < 0) continue;
        const s = slots[e.slot];
        if (s === undefined) continue;
        if (e.kind === 'firework') {
          s.fw.visible = true;
          const size = 0.075 * (1 - t / dur) + 0.01;
          for (let i = 0; i < PARTICLES; i++) {
            dummy.position.set(s.p[0] + e.vel[i * 3]! * t, HEAD_Y + e.vel[i * 3 + 1]! * t - 2.2 * t * t, s.p[2] + 0.3 + e.vel[i * 3 + 2]! * t);
            dummy.rotation.set(t * 5 + i, t * 3, 0);
            dummy.scale.setScalar(size);
            dummy.updateMatrix();
            s.fw.setMatrixAt(i, dummy.matrix);
          }
          s.fw.instanceMatrix.needsUpdate = true;
        } else {
          const m = e.mark === 'question' ? s.question : s.anger;
          m.visible = true;
          // 튀어나오며(오버슈트) 나타나고 끝에서 줄어든다.
          const pop = t < 0.18 ? 1 + Math.sin((t / 0.18) * Math.PI) * 0.25 : 1;
          const fade = t > dur - 0.2 ? Math.max((dur - t) / 0.2, 0) : 1;
          m.scale.setScalar(1.7 * Math.min(t / 0.12, 1) * pop * fade);
          m.position.set(s.p[0], HEAD_Y + Math.sin(t * 9) * 0.04, s.p[2] + 0.25);
          m.quaternion.copy(camera.quaternion); // 항상 화면을 향한다.
          if (e.kind === 'fumed' && t < DURATION.shake) {
            const k = 1 - t / DURATION.shake;
            shake = [Math.sin(t * 110) * 0.1 * k, Math.cos(t * 95) * 0.07 * k];
          }
        }
      }
      return shake;
    },
  };
}
