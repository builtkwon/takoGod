// 오버레이 스타일. 레이어는 입력을 통과시키고 .ui-hit 요소만 입력을 받는다(아래 렌더 캔버스 입력 보호).
import { Z } from './z';

export const CSS = `
.ui-layer{position:absolute;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;overflow:hidden;user-select:none}
.ui-hit{pointer-events:auto}
.ui-layer button{font:inherit;color:inherit;border:2px solid #fff;background:#3a2a1a;border-radius:8px;padding:6px 10px;touch-action:manipulation}
.ui-layer [hidden]{display:none!important}
.ui-hud-row{display:flex;gap:8px;align-items:center;justify-content:space-between}
.ui-guide{position:absolute;top:116px;left:12px;right:12px;padding:8px;background:#fff;color:#222;border-radius:8px;text-align:center;font-weight:700}
.ui-warning{position:absolute;top:162px;left:12px;right:12px;padding:8px;background:#c62828;border-radius:8px;text-align:center;font-weight:700}
.ui-shake{animation:ui-shake .4s}
.ui-bubble{position:absolute;height:76px;box-sizing:border-box;overflow:hidden;left:12px;right:12px;padding:8px 12px;background:#fff;color:#222;border-radius:12px;font-size:15px}
.ui-bubble p{margin:2px 0}
.ui-fumed{background:#ffe0dc;color:#7a1008;font-weight:700;pointer-events:none}
.ui-timer{position:absolute;right:10px;top:6px;font-size:12px;color:#c62828}
.ui-answer{position:absolute;box-sizing:border-box;font-size:14px}
.ui-overlay{position:absolute;z-index:${Z.OVERLAY};inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#000c;text-align:center}
.ui-title h1{font-size:40px;margin:0}
.ui-layer .ui-secondary{font-size:15px;padding:6px 20px;background:transparent;border-color:#fff8;color:#fffc}
.ui-big{font-size:22px;padding:12px 36px!important}
.ui-card{background:#fff;color:#222;border-radius:12px;padding:12px 16px;max-width:80%}
.ui-toasts{position:absolute;left:0;right:0;bottom:200px;display:flex;flex-direction:column-reverse;align-items:center;gap:6px}
.ui-stars{color:#ffb300;font-size:24px}
.ui-version{position:absolute;bottom:10px;left:0;right:0;text-align:center;font-size:12px;color:#fff8;user-select:text;-webkit-user-select:text}
.ui-score{font-size:56px;font-weight:700}
@keyframes ui-shake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
