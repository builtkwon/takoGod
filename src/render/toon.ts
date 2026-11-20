// 툰 셰이딩 공통: 3단 셀 조명 머티리얼 + inverted hull 외곽선. 결정: ADR 0002 초안(PS1 파이프라인 대체).
import { BackSide, DataTexture, Float32BufferAttribute, Mesh, MeshToonMaterial, NearestFilter, RGBAFormat, ShaderMaterial, UnsignedByteType, Vector2 } from 'three';
import type { BufferGeometry } from 'three';

/** 화면에서 보이는 외곽선 두께(CSS px). */
export const OUTLINE_PX = 2;
/** 외곽선 색(거의 검정, 약간 보라). */
const OUTLINE_RGB = [0.07, 0.04, 0.1] as const;

let gradient: DataTexture | null = null;
/** 밝기 3단 그라데이션(NearestFilter라 단 사이가 딱 끊긴다). 모듈 공용 1장. */
function gradientMap(): DataTexture {
  if (gradient === null) {
    gradient = new DataTexture(new Uint8Array([100, 100, 100, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, RGBAFormat, UnsignedByteType);
    gradient.magFilter = NearestFilter;
    gradient.minFilter = NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

/** 모든 모델이 쓰는 셀 셰이딩 머티리얼. 지오메트리에 `color` 속성(버텍스 컬러)이 있어야 한다. map은 선택, tint는 material.color로 곱한다. */
export function toon(map: DataTexture | null = null): MeshToonMaterial {
  return new MeshToonMaterial({ vertexColors: true, map, gradientMap: gradientMap() });
}

const VERT = /* glsl */ `
uniform vec2 uRes;
uniform float uPx;
attribute vec3 onormal;
void main() {
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // 법선(클립 xy 방향)으로 uPx 픽셀만 밀어 두께를 화면에서 일정하게 둔다.
  vec2 d = (projectionMatrix * vec4(normalize(normalMatrix * onormal), 0.0)).xy;
  float l = length(d);
  if (l > 1e-5) p.xy += d / l * (uPx * 2.0 / uRes) * p.w;
  gl_Position = p;
}`;

const FRAG = /* glsl */ `
void main() { gl_FragColor = vec4(${OUTLINE_RGB.join(', ')}, 1.0); }`;

/** 외곽선 머티리얼(뒷면만 그린다). 해상도는 렌더러가 setOutlineRes로 갱신한다. */
export function createOutline(): ShaderMaterial {
  return new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: BackSide, uniforms: { uRes: { value: new Vector2(1, 1) }, uPx: { value: OUTLINE_PX } } });
}

/** 렌더 버퍼 크기(px)와 CSS 대비 배율로 두께를 맞춘다. */
export function setOutlineRes(m: ShaderMaterial, bufW: number, bufH: number, pixelRatio: number): void {
  (m.uniforms.uRes!.value as Vector2).set(bufW, bufH);
  m.uniforms.uPx!.value = OUTLINE_PX * pixelRatio;
}

/** 면 법선(플랫)을 같은 위치끼리 평균낸 부드러운 법선 `onormal`. 플랫 법선으로 부풀리면 모서리가 갈라져서 필요하다. 한 번만 만든다. */
function ensureOutlineNormals(g: BufferGeometry): void {
  if (g.getAttribute('onormal') !== undefined) return;
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const key = (i: number) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  const sum = new Map<string, [number, number, number]>();
  for (let i = 0; i < p.count; i++) {
    const s = sum.get(key(i)) ?? [0, 0, 0];
    s[0] += n.getX(i);
    s[1] += n.getY(i);
    s[2] += n.getZ(i);
    sum.set(key(i), s);
  }
  const out: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const s = sum.get(key(i))!;
    const l = Math.hypot(...s);
    out.push(...(l < 1e-6 ? [0, 1, 0] : [s[0] / l, s[1] / l, s[2] / l]));
  }
  g.setAttribute('onormal', new Float32BufferAttribute(out, 3));
}

/** mesh에 외곽선 자식 메시(같은 지오메트리·변환)를 붙인다. mesh 가시성·스케일을 그대로 따른다. */
export function addOutline<T extends Mesh>(mesh: T, outline: ShaderMaterial): T {
  ensureOutlineNormals(mesh.geometry);
  mesh.add(new Mesh(mesh.geometry, outline));
  return mesh;
}

/** 외곽선이 붙은 메시의 지오메트리를 바꾼다(본체·외곽선 같이). */
export function setGeometry(mesh: Mesh, geo: BufferGeometry): void {
  mesh.geometry = geo;
  const o = mesh.children[0];
  if (o instanceof Mesh) {
    ensureOutlineNormals(geo);
    o.geometry = geo;
  }
}
