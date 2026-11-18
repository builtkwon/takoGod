// Three.js PS1 렌더러. GameState를 읽어 그리기만 한다(게임 규칙 없음).
import {
  Color,
  Group,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { GameState, HoleState } from '../contracts';
import {
  BALL_UNIT,
  CUSTOMER_POS,
  DISC_UNIT,
  DOUGH_LOOKS,
  FILLING_GEO,
  HOLE_POS,
  MODEL_OF,
  TRAY_TOP,
  TRAY_X,
  TRAY_Z,
  buildCustomer,
  buildStatic,
  doughTint,
} from './models';
import type { CustomerModel } from './models';
import { RT_H, RT_W, postMaterial, ps1Material } from './ps1';
import { createTextures } from './textures';

export interface Ps1Renderer {
  /** 상태를 그린다. 매 프레임 호출해도 된다(변경 없는 부분은 갱신하지 않는다). */
  render(state: GameState): void;
  dispose(): void;
}

/** container 안에 렌더타깃 비율(RT_W x RT_H, 현재 240x320 세로 3:4) 캔버스를 맞춰 넣는다.캔버스 버퍼는 렌더타깃 크기이고 CSS로 nearest 확대한다. */
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

  const camera = new PerspectiveCamera(45, RT_W / RT_H, 0.1, 50);
  camera.position.set(0, 7.5, 6.5);
  camera.lookAt(0, 0.4, -0.3);

  const tex = createTextures();
  const scene = new Scene();
  scene.add(buildStatic(tex));

  const doughTex = { butter: tex.butter, batter: tex.batter, crust: tex.crust, sauce: tex.sauce } as const;
  const fillMat = ps1Material(tex.grain);

  const holes = HOLE_POS.map((p) => {
    const tint = new Vector3(1, 1, 1);
    const mat = ps1Material(tex.batter, tint, 0.00015);
    const dough = new Mesh(DISC_UNIT, mat);
    const fill = new Mesh(FILLING_GEO.octopus, fillMat);
    const g = new Group();
    g.position.set(...p);
    g.add(dough, fill);
    scene.add(g);
    return { dough, fill, mat, tint };
  });

  const tray = TRAY_X.map((x) => {
    const m = new Mesh(FILLING_GEO.octopus, fillMat);
    m.position.set(x, TRAY_TOP, TRAY_Z);
    scene.add(m);
    return m;
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

  function updateHole(i: number, h: HoleState): void {
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
      v.tint.set(...doughTint(h.step, h.gauge, h.judgements));
    }
    const filled = h.step === 'cook-2' && h.filling !== null;
    v.fill.visible = filled;
    if (filled && h.filling !== null) {
      v.fill.geometry = FILLING_GEO[h.filling];
      v.fill.position.y = 0.09;
    }
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
    render(state) {
      state.holes.forEach((h) => updateHole(h.index, h));
      tray.forEach((m, i) => {
        const ing = state.tray[i];
        m.visible = ing !== undefined;
        if (ing !== undefined) m.geometry = FILLING_GEO[ing.id];
      });
      slots.forEach((models, i) => {
        const c = state.customers[i];
        for (const [kind, m] of Object.entries(models)) m.visible = c !== undefined && MODEL_OF[c.personality] === kind;
      });
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    },
    dispose() {
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof Mesh) o.material.dispose();
      });
      tex.all.forEach((t) => t.dispose());
      rt.dispose();
      postMat.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
