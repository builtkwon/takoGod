// PS1 공통 머티리얼·후처리 셰이더. 결정: docs/adr/0001-ps1-render-pipeline.md
import { ShaderMaterial, Vector2, Vector3 } from 'three';
import type { DataTexture, Texture } from 'three';

/** GDD §제품 렌더타깃 해상도. 세로 240x320 전환은 미정(ADR 0001)이라 이 상수만 바꾸면 된다. */
export const RT_W = 320;
export const RT_H = 240;

const VERT = /* glsl */ `
uniform vec2 uRes;
uniform float uBias;
varying vec2 vUv;
varying float vW;
varying vec3 vShade;
void main() {
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // 스냅핑이 면의 깊이를 흔들어 겹친 면이 z-fighting 하므로 데칼은 카메라 쪽으로 살짝 당긴다.
  p.z -= uBias * p.w;
  // 버텍스 스내핑: 클립 좌표를 렌더타깃 픽셀 격자에 맞춘다.
  vec2 px = floor((p.xy / p.w * 0.5 + 0.5) * uRes + 0.5);
  p.xy = ((px / uRes) * 2.0 - 1.0) * p.w;
  gl_Position = p;
  // affine: w를 곱해 보간하고 프래그먼트에서 나눠 원근 보정을 지운다.
  vUv = uv * p.w;
  vW = p.w;
  // 고라우 셰이딩(버텍스 단위 조명) + 버텍스 컬러.
  vec3 n = normalize(normalMatrix * normal);
  float lit = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.3, 0.8, 0.6))), 0.0);
  vShade = color * lit;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uTint;
varying vec2 vUv;
varying float vW;
varying vec3 vShade;
void main() {
  vec3 c = texture2D(uMap, vUv / vW).rgb * vShade * uTint;
  gl_FragColor = vec4(c, 1.0);
}`;

/** 모든 메시가 쓰는 PS1 머티리얼. 지오메트리에 `color` 속성(버텍스 컬러)이 있어야 한다. bias>0이면 같은 면 위에 얹는 데칼용 깊이 보정. */
export function ps1Material(map: DataTexture, tint = new Vector3(1, 1, 1), bias = 0): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    vertexColors: true,
    uniforms: { uMap: { value: map }, uTint: { value: tint }, uBias: { value: bias }, uRes: { value: new Vector2(RT_W, RT_H) } },
  });
}

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// 4x4 Bayer 디더(4bit, 8비트 기준 -4..+3.5 오프셋) 뒤 RGB555(채널당 5비트) 양자화.
const POST_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uRes;
varying vec2 vUv;
float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = y * 4 + x;
  float m[16] = float[16](0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.);
  return m[i];
}
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * 255.0;
  c += (bayer(floor(vUv * uRes)) / 16.0 - 0.5) * 8.0;
  c = floor(clamp(c, 0.0, 255.0) / 8.0) / 31.0;
  gl_FragColor = vec4(min(c, 1.0), 1.0);
}`;

export function postMaterial(rt: Texture): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: { tDiffuse: { value: rt }, uRes: { value: new Vector2(RT_W, RT_H) } },
  });
}
