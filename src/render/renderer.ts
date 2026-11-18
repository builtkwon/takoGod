// Three.js PS1 렌더러. GameState를 읽어 그리기만 한다(게임 규칙 없음).
import {
  Color,
  DataTexture,
  Group,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { GameState, GameStateV2, HoleState, HoleStateV2, ScenePicker } from '../contracts';
import {
  BALL_UNIT,
  CUSTOMER_POS,
  DISC_UNIT,
  DOUGH_LOOKS,
  FILLING_GEO,
  FUNE_BALL_R,
  FUNE_SLOTS,
  HOLE_POS,
  MODEL_OF,
  NOFILL_MARK,
  RIM_UNIT,
  TRAY_TOP,
  TRAY_X,
  TRAY_Z,
  buildCustomer,
  buildFune,
  bakeTint,
  buildStatic,
  doughTint,
} from './models';
import type { BakeStage, CustomerModel } from './models';
import { CAMERA } from './layout';
import { FACE_TINT, RIM_COLOR, holeTint, lookStepOf, rimOf, rimVisible, showsFilling, showsNoFilling } from './holes';
import { createScenePicker } from './pick';
import { RT_H, RT_W, postMaterial, ps1Material } from './ps1';
import { createTextures } from './textures';

/**
 * GameState에 아직 없는 표시 정보. contracts 굽기 개편 전까지 render 로컬 타입이다.
 * 생략하면 모두 보통 완성, 후네는 비어 있다.
 */
export interface RenderExtra {
  /** 구멍 인덱스별 색 단계. */
  readonly stages?: readonly BakeStage[];
  /** 후네에 담긴 타코야끼(앞에서부터 슬롯 0..5). */
  readonly fune?: readonly BakeStage[];
}

export interface Ps1Renderer {
  /** 상태를 그린다. 매 프레임 호출해도 된다(변경 없는 부분은 갱신하지 않는다). */
  render(state: GameState, extra?: RenderExtra): void;
  /**
   * 굽기 개편(GameStateV2)을 그린다. 구멍 9단계·속 없음·테두리(warn 깜빡임)·후네 내용·손님 얼굴 단계·트레이 표시 순서를 따른다.
   * 들고 있는 구멍(holding)은 그리지 않는다(ui가 손가락 아래에 그린다). nowMs는 깜빡임 위상용이며 기본은 performance.now()다.
   * 옛 render와 번갈아 부르지 않는다(구멍·손님 색조를 서로 덮어쓴다).
   */
  renderV2(state: GameStateV2, nowMs?: number): void;
  /** 화면 좌표 ↔ 장면 대상(contracts ScenePicker). 마지막으로 그린 트레이 칸 수를 기준으로 한다. */
  readonly picker: ScenePicker;
  dispose(): void;
}

/** container 안에 렌더타깃 비율(RT_W x RT_H, 현재 240x320 세로 3:4) 캔버스를 맞춰 넣는다. 캔버스 버퍼는 렌더타깃 크기이고 CSS로 nearest 확대한다. */
export function createRenderer(container: HTMLElement): Ps1Renderer {
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1); // ADR 0001: 업스케일 배율은 CSS 크기로 정한다.
  renderer.setSize(RT_W, RT_H, false);
  renderer.setClearColor(new Color().setRGB(27 / 255, 20 / 255, 36 / 255)); // 셰이더가 sRGB 변환을 안 하므로 raw 값.
  const canvas = renderer.domElement;
  canvas.style.imageRendering = 'pixelated';
  container.appendChild(canvas);

  const rt = new WebGLRenderTarget(RT_W, RT_H, { magFilter: NearestFilter, minFilter: NearestFilter, generateMipmaps: false });
  const postMat = postMaterial(rt.texture);
  const postScene = new Scene();
  postScene.add(new Mesh(new PlaneGeometry(2, 2), postMat));
  const postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const camera = new PerspectiveCamera(CAMERA.fovDeg, CAMERA.aspect, 0.1, 50);
  camera.position.set(...CAMERA.pos); // 카메라 값은 layout.ts(pick과 공유).
  camera.lookAt(...CAMERA.target);

  const tex = createTextures();
  const scene = new Scene();
  scene.add(buildStatic(tex), buildFune(tex));

  const doughTex = { butter: tex.butter, batter: tex.batter, crust: tex.crust, sauce: tex.sauce } as const;
  const fillMat = ps1Material(tex.grain);

  const white = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat, UnsignedByteType);
  white.magFilter = NearestFilter;
  white.minFilter = NearestFilter;
  white.needsUpdate = true;

  const holes = HOLE_POS.map((p) => {
    const tint = new Vector3(1, 1, 1);
    const mat = ps1Material(tex.batter, tint, 0.00015);
    const dough = new Mesh(DISC_UNIT, mat);
    const fill = new Mesh(FILLING_GEO.octopus, fillMat);
    const g = new Group();
    g.position.set(...p);
    // 테두리·속 없음 표시는 V2 전용. 옛 render는 항상 숨긴 채 둔다.
    const rimTint = new Vector3(1, 1, 1);
    const rim = new Mesh(RIM_UNIT, ps1Material(white, rimTint, 0.0002));
    rim.position.y = 0.016;
    rim.visible = false;
    const mark = new Mesh(NOFILL_MARK, fillMat);
    mark.visible = false;
    g.add(dough, fill, rim, mark);
    scene.add(g);
    return { dough, fill, mat, tint, rim, rimTint, mark };
  });

  let trayCount = 0;
  const trayMeshes = TRAY_X.map((x) => {
    const m = new Mesh(FILLING_GEO.octopus, fillMat);
    m.position.set(x, TRAY_TOP, TRAY_Z);
    scene.add(m);
    return m;
  });

  const funeBalls = FUNE_SLOTS.map(([x, y, z]) => {
    const tint = new Vector3(1, 1, 1);
    const m = new Mesh(BALL_UNIT, ps1Material(tex.sauce, tint, 0.00015));
    m.scale.set(FUNE_BALL_R, FUNE_BALL_R, FUNE_BALL_R);
    m.position.set(x, y + FUNE_BALL_R * 0.7, z);
    m.visible = false;
    scene.add(m);
    return { m, tint };
  });

  // 손님 슬롯마다 모델별 그룹을 미리 만들고 보이기만 바꾼다.
  const slots = CUSTOMER_POS.map((p) => {
    const models: Record<CustomerModel, Group> = { salaryman: buildCustomer('salaryman', tex), grandma: buildCustomer('grandma', tex) };
    for (const m of Object.values(models)) {
      m.position.set(...p);
      m.visible = false;
      scene.add(m);
    }
    return models;
  });

  /** 손님 그룹의 머리 머티리얼 tint(buildCustomer: children[1]이 머리). */
  const faceTint = (g: Group): Vector3 => ((g.children[1] as Mesh).material as ShaderMaterial).uniforms.uTint!.value as Vector3;

  function updateHole(i: number, h: HoleState, stage: BakeStage | undefined): void {
    const v = holes[i];
    if (v === undefined) return;
    const look = DOUGH_LOOKS[h.step];
    v.dough.visible = look !== null;
    if (look !== null) {
      v.dough.geometry = look.kind === 'disc' ? DISC_UNIT : BALL_UNIT;
      v.mat.uniforms.uMap!.value = doughTex[look.tex];
      const sy = look.kind === 'disc' ? look.h : look.r * look.h;
      v.dough.scale.set(look.r, sy, look.r);
      v.dough.position.y = look.kind === 'disc' ? sy / 2 + 0.012 : sy * 0.7;
      v.tint.set(...doughTint(h.step, h.gauge, h.judgements, stage));
    }
    const filled = h.step === 'cook-2' && h.filling !== null;
    v.fill.visible = filled;
    if (filled && h.filling !== null) {
      v.fill.geometry = FILLING_GEO[h.filling];
      v.fill.position.y = 0.09;
    }
  }

  function updateHoleV2(i: number, h: HoleStateV2, held: boolean, nowMs: number): void {
    const v = holes[i];
    if (v === undefined) return;
    const look = held ? null : DOUGH_LOOKS[lookStepOf(h.stage)];
    v.dough.visible = look !== null;
    v.mark.visible = false;
    if (look !== null) {
      v.dough.geometry = look.kind === 'disc' ? DISC_UNIT : BALL_UNIT;
      v.mat.uniforms.uMap!.value = doughTex[look.tex];
      const sy = look.kind === 'disc' ? look.h : look.r * look.h;
      v.dough.scale.set(look.r, sy, look.r);
      v.dough.position.y = look.kind === 'disc' ? sy / 2 + 0.012 : sy * 0.7;
      v.tint.set(...holeTint(h));
      if (showsNoFilling(h)) {
        v.mark.visible = true;
        v.mark.position.y = v.dough.position.y + sy + 0.03;
      }
    }
    const filled = !held && showsFilling(h);
    v.fill.visible = filled;
    if (filled && h.filling !== null) {
      v.fill.geometry = FILLING_GEO[h.filling];
      v.fill.position.y = 0.09;
    }
    const rim = rimOf(h);
    v.rim.visible = !held && rimVisible(h, nowMs);
    if (rim !== null) v.rimTint.set(...RIM_COLOR[rim]);
  }

  function updateTrayFune(tray: GameState['tray'], funeStages: readonly (BakeStage | undefined)[]): void {
    trayCount = tray.length;
    funeBalls.forEach((b, i) => {
      const stage = funeStages[i];
      b.m.visible = stage !== undefined;
      if (stage !== undefined) b.tint.set(...bakeTint(stage));
    });
    trayMeshes.forEach((m, i) => {
      const ing = tray[i];
      m.visible = ing !== undefined;
      if (ing !== undefined) m.geometry = FILLING_GEO[ing.id];
    });
  }

  function draw(): void {
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  const fit = () => {
    const s = Math.min(container.clientWidth / RT_W, container.clientHeight / RT_H);
    if (s > 0) {
      canvas.style.width = `${Math.floor(RT_W * s)}px`;
      canvas.style.height = `${Math.floor(RT_H * s)}px`;
    }
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(container);

  return {
    picker: createScenePicker(canvas, () => trayCount),
    render(state, extra) {
      state.holes.forEach((h) => updateHole(h.index, h, extra?.stages?.[h.index]));
      updateTrayFune(state.tray, extra?.fune ?? []);
      slots.forEach((models, i) => {
        const c = state.customers[i];
        for (const [kind, m] of Object.entries(models)) m.visible = c !== undefined && MODEL_OF[c.personality] === kind;
      });
      draw();
    },
    renderV2(state, nowMs = performance.now()) {
      state.holes.forEach((h) => updateHoleV2(h.index, h, state.holding === h.index, nowMs));
      updateTrayFune(
        state.tray,
        state.fune.map((f): BakeStage => (f.dark ? 'dark' : 'normal')),
      );
      slots.forEach((models, i) => {
        const c = state.customers[i];
        for (const [kind, m] of Object.entries(models)) {
          m.visible = c !== undefined && MODEL_OF[c.personality] === kind;
          if (c !== undefined) faceTint(m).set(...FACE_TINT[c.face]);
        }
      });
      draw();
    },
    dispose() {
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof Mesh) o.material.dispose();
      });
      tex.all.forEach((t) => t.dispose());
      white.dispose();
      rt.dispose();
      postMat.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
