// Three.js 툰 렌더러. GameState를 읽어 그리기만 한다(게임 규칙 없음). 셀 셰이딩 + inverted hull 외곽선, 화면 해상도 렌더.
import {
  AmbientLight,
  Color,
  ColorManagement,
  DirectionalLight,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import type { GameStateV2, HoleStateV2, ScenePicker } from '../contracts';
import {
  BALL_UNIT,
  CUSTOMER_POS,
  DISC_UNIT,
  DOUGH_BASE,
  DOUGH_LOOKS,
  FILLING_GEO,
  FUNE_BALL_R,
  FUNE_SLOTS,
  HOLE_POS,
  LOCK_UNIT,
  MODEL_OF,
  NOFILL_MARK,
  RIM_UNIT,
  TRAY_TOP,
  TRAY_X,
  TRAY_Z,
  buildCustomer,
  buildFune,
  buildKatsuobushi,
  bakeTint,
  buildStatic,
} from './models';
import type { BakeStage, CustomerModel } from './models';
import { CAMERA, TAKO_S } from './layout';
import { admit, createEffects } from './effects';
import type { EffectKind, EffectOptions } from './effects';
import { FACE_TINT, RIM_COLOR, holeTint, rimOf, rimVisible, showsFilling, showsNoFilling } from './holes';
import { buildBackdrop } from './backdrop';
import { createScenePicker } from './pick';
import { MAX_PIXEL_RATIO, VIEW_ASPECT } from './dims';
import { addOutline, createOutline, setGeometry, setMap, setOutlineRes, toon } from './toon';
import { assignSlots } from './slots';
import { createTextures } from './textures';

export interface ToonRenderer {
  /**
   * 상태를 그린다. 매 프레임 호출해도 된다. 구멍 9단계·속 없음·테두리(warn 깜빡임)·후네 내용·손님 얼굴 단계·트레이 표시 순서를 따른다.
   * 들고 있는 구멍(holding)은 그리지 않는다(ui가 손가락 아래에 그린다). nowMs는 깜빡임 위상용이며 기본은 performance.now()다.
   */
  renderV2(state: GameStateV2, nowMs?: number): void;
  /**
   * 연출을 시작한다(판정과 무관). customerId는 GameStateV2.customers[].id이며 다음 renderV2에서 그 손님 자리에 붙고 매 프레임 id로 자리를 다시 찾는다(손님이 나가면 이펙트가 끝난다).
   * 그 시점에 id가 없으면 firework·confused는 무시하고, fumed는 화면 흔들림만 하고 분노 표시는 생략한다.
   * firework 폭죽 약 1초 / confused 머리 위 물음표 또는 빠직 1.5초(opts.mark로 고정, 기본 무작위) / fumed 카메라 0.4초 흔들림 + 분노 표시.
   * 시계는 renderV2의 nowMs와 같다. opts.startMs로 시작 시각, opts.seed로 모양을 고정할 수 있다(스냅샷·테스트용).
   */
  effect(kind: EffectKind, customerId: string, opts?: EffectOptions): void;
  /** 화면 좌표 ↔ 장면 대상(contracts ScenePicker). 마지막으로 그린 트레이 칸 수를 기준으로 한다. */
  readonly picker: ScenePicker;
  dispose(): void;
}

/**
 * container 안에 3:4 비율 캔버스를 맞춰 넣는다. 버퍼 해상도는 CSS 크기 x min(devicePixelRatio, MAX_PIXEL_RATIO)이다.
 * 셰이더가 색공간 변환을 하지 않으므로(ColorManagement 끔) 색 값은 화면에 보이는 sRGB 값 그대로다.
 */
export function createRenderer(container: HTMLElement): ToonRenderer {
  ColorManagement.enabled = false;
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(new Color().setRGB(18 / 255, 22 / 255, 58 / 255)); // 배경이 못 덮는 가장자리용 짙은 남색.
  const canvas = renderer.domElement;
  container.appendChild(canvas);

  const camera = new PerspectiveCamera(CAMERA.fovDeg, CAMERA.aspect, 0.1, 50);
  camera.position.set(...CAMERA.pos); // 카메라 값은 layout.ts(pick과 공유).
  camera.lookAt(...CAMERA.target);
  camera.updateMatrixWorld();

  const tex = createTextures();
  const outline = createOutline();
  const scene = new Scene();
  // 조명: 앰비언트 + 방향광 1개(그림자 맵 없음). 세기는 셀 3단 그라데이션 기준으로 맞췄다.
  const sun = new DirectionalLight(0xffffff, Math.PI * 0.55);
  sun.position.set(-3, 8, 6);
  scene.add(new AmbientLight(0xffffff, Math.PI * 0.45), sun);
  scene.add(buildBackdrop(), buildStatic(tex, outline), buildFune(tex, outline));
  const katsuo = buildKatsuobushi(outline);
  scene.add(...katsuo);
  const effects = createEffects(scene, camera, outline);

  const doughMap = { butter: null, batter: null, crust: null, sauce: tex.sauce } as const;
  const fillMat = toon();

  const holes = HOLE_POS.map((p) => {
    const mat = toon();
    const dough = addOutline(new Mesh(DISC_UNIT, mat), outline);
    const fill = addOutline(new Mesh(FILLING_GEO.octopus, fillMat), outline);
    const g = new Group();
    g.position.set(...p);
    const rimMat = new MeshBasicMaterial({ vertexColors: true }); // 조명 없이 지정색 그대로(초록·흰·주황).
    const rim = new Mesh(RIM_UNIT, rimMat);
    rim.position.y = 0.02;
    rim.visible = false;
    fill.scale.setScalar(TAKO_S);
    const mark = new Mesh(NOFILL_MARK, fillMat);
    mark.visible = false;
    const lock = new Mesh(LOCK_UNIT, toon());
    lock.visible = false;
    g.add(dough, fill, rim, mark, lock);
    scene.add(g);
    return { dough, fill, mat, rim, rimMat, mark, lock };
  });

  let trayCount = 0;
  const trayMeshes = TRAY_X.map((x) => {
    const m = addOutline(new Mesh(FILLING_GEO.octopus, fillMat), outline);
    m.position.set(x, TRAY_TOP, TRAY_Z);
    scene.add(m);
    return m;
  });

  const funeBalls = FUNE_SLOTS.map(([x, y, z]) => {
    const mat = toon(tex.sauce);
    const m = addOutline(new Mesh(BALL_UNIT, mat), outline);
    m.scale.set(FUNE_BALL_R, FUNE_BALL_R, FUNE_BALL_R);
    m.position.set(x, y + FUNE_BALL_R * 0.7, z);
    m.visible = false;
    scene.add(m);
    return { m, mat };
  });

  // 손님 슬롯마다 모델별 그룹을 미리 만들고 보이기만 바꾼다.
  const slots = CUSTOMER_POS.map((p) => {
    const models: Record<CustomerModel, Group> = { salaryman: buildCustomer('salaryman', outline), grandma: buildCustomer('grandma', outline) };
    for (const m of Object.values(models)) {
      m.position.set(...p);
      m.visible = false;
      scene.add(m);
    }
    return models;
  });

  /** 손님 그룹의 머리 머티리얼 tint(buildCustomer: children[1]이 머리). */
  const faceMat = (g: Group): MeshToonMaterial => (g.children[1] as Mesh).material as MeshToonMaterial;

  function updateHoleV2(i: number, h: HoleStateV2, held: boolean, nowMs: number): void {
    const v = holes[i];
    if (v === undefined) return;
    v.lock.visible = h.locked; // 잠긴 구멍은 뚜껑으로 어둡게 덮고 테두리·알은 그리지 않는다.
    const look = held || h.locked ? null : DOUGH_LOOKS[h.stage];
    v.dough.visible = look !== null;
    v.mark.visible = false;
    if (look !== null) {
      setGeometry(v.dough, look.kind === 'disc' ? DISC_UNIT : BALL_UNIT);
      setMap(v.mat, doughMap[look.tex]);
      const sy = look.kind === 'disc' ? look.h : look.r * look.h;
      v.dough.scale.set(look.r, sy, look.r);
      v.dough.position.y = look.kind === 'disc' ? sy / 2 + 0.012 : sy * 0.7;
      const base = DOUGH_BASE[look.tex];
      const t = holeTint(h);
      v.mat.color.setRGB(base[0] * t[0], base[1] * t[1], base[2] * t[2]);
      if (showsNoFilling(h)) {
        v.mark.visible = true;
        v.mark.position.y = v.dough.position.y + sy + 0.03;
      }
    }
    const filled = !held && !h.locked && showsFilling(h);
    v.fill.visible = filled;
    if (filled && h.filling !== null) {
      setGeometry(v.fill, FILLING_GEO[h.filling]);
      v.fill.position.y = 0.09 * TAKO_S;
    }
    const rim = rimOf(h);
    v.rim.visible = !held && !h.locked && rimVisible(h, nowMs);
    if (rim !== null) v.rimMat.color.setRGB(...RIM_COLOR[rim]);
  }

  function updateTrayFune(tray: GameStateV2['tray'], funeStages: readonly (BakeStage | undefined)[]): void {
    trayCount = tray.length;
    funeBalls.forEach((b, i) => {
      const stage = funeStages[i];
      b.m.visible = stage !== undefined;
      if (stage !== undefined) b.mat.color.setRGB(...bakeTint(stage));
    });
    trayMeshes.forEach((m, i) => {
      const ing = tray[i];
      m.visible = ing !== undefined;
      if (ing !== undefined) setGeometry(m, FILLING_GEO[ing.id]);
    });
  }

  const katsuoY = katsuo.map((g) => g.position.y);
  let customerIds: string[] = [];
  let slotIds: (string | null)[] = slots.map(() => null);
  const pending: { kind: EffectKind; id: string; opts: EffectOptions | undefined }[] = [];
  let drawn = false;
  function draw(): void {
    renderer.render(scene, camera);
    drawn = true;
  }

  const fit = () => {
    const w = Math.floor(Math.min(container.clientWidth, container.clientHeight * VIEW_ASPECT));
    if (w <= 0) return;
    const h = Math.floor(w / VIEW_ASPECT);
    renderer.setSize(w, h); // 버퍼 w*pixelRatio, CSS w px. 버퍼가 비워지므로 다시 그린다.
    setOutlineRes(outline, w * pixelRatio, h * pixelRatio, pixelRatio);
    if (drawn) draw();
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(container);

  return {
    picker: createScenePicker(canvas, () => trayCount),
    renderV2(state, nowMs = performance.now()) {
      state.holes.forEach((h) => updateHoleV2(h.index, h, state.holding === h.index, nowMs));
      updateTrayFune(
        state.tray,
        state.fune.map((f): BakeStage => (f.dark ? 'dark' : 'normal')),
      );
      slotIds = assignSlots(slotIds, state.customers.map((c) => c.id));
      slots.forEach((models, i) => {
        const c = state.customers.find((x) => x.id === slotIds[i]);
        for (const [kind, m] of Object.entries(models)) {
          m.visible = c !== undefined && MODEL_OF[c.personality] === kind;
          if (c !== undefined) faceMat(m).color.setRGB(...FACE_TINT[c.face]);
        }
      });
      // funeServing(후네가 가득 찬 뒤 서빙 또는 비우기 전까지. 손님이 없으면 1초보다 길 수 있다) 동안 가쓰오부시를 얹고 살랑이게 한다.
      katsuo.forEach((g, i) => {
        g.visible = state.funeServing;
        g.rotation.set(Math.sin(nowMs / 170 + i) * 0.1, g.rotation.y, Math.sin(nowMs / 140 + i * 1.7) * 0.12);
        g.position.y = katsuoY[i]! + Math.sin(nowMs / 120 + i * 1.3) * 0.02;
      });
      customerIds = state.customers.map((c) => c.id);
      for (const q of pending.splice(0)) {
        // 이벤트 뒤 같은 틱에 손님이 이미 나갔으면 firework·confused는 버린다. fumed는 화면 흔들림이 손님과 무관해 id가 없어도 시작한다.
        if (admit(q.kind, customerIds.includes(q.id))) effects.trigger(q.kind, q.id, nowMs, q.opts);
      }
      const [dx, dy] = effects.update(nowMs, (id) => slotIds.indexOf(id));
      camera.position.set(CAMERA.pos[0] + dx, CAMERA.pos[1] + dy, CAMERA.pos[2]);
      draw();
    },
    effect(kind, customerId, opts) {
      pending.push({ kind, id: customerId, opts });
    },
    dispose() {
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof Mesh) o.material.dispose();
      });
      tex.all.forEach((t) => t.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}
