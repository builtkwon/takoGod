// 오버레이 스타일. 레이어는 입력을 통과시키고 .ui-hit 요소만 입력을 받는다(아래 렌더 캔버스 입력 보호).
import { Z } from './z';

export const CSS = `
.ui-layer{position:absolute;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;overflow:hidden;user-select:none}
.ui-hit{pointer-events:auto}
.ui-layer button{font:inherit;color:inherit;border:2px solid #fff;background:#3a2a1a;border-radius:8px;padding:6px 10px;touch-action:manipulation}
.ui-layer [hidden]{display:none!important}
.ui-hud-row{display:flex;gap:8px;align-items:center;justify-content:space-between}
.ui-guide{position:absolute;top:var(--ui-guide-top,116px);left:12px;right:12px;padding:8px;background:#fff;color:#222;border-radius:8px;text-align:center;font-weight:700}
.ui-warning{position:absolute;top:var(--ui-warning-top,162px);left:12px;right:12px;padding:8px;background:#c62828;border-radius:8px;text-align:center;font-weight:700}
.ui-shake{animation:ui-shake .4s}
.ui-bubble{position:absolute;max-height:54px;box-sizing:border-box;overflow:hidden;left:8px;width:55%;padding:3px 8px;background:#fff;color:#222;border-radius:8px;font-size:12px;line-height:1.25;word-break:keep-all}
.ui-bubble b{margin-right:5px;font-size:11px}
.ui-bubble p{display:inline;margin:0}
.ui-bubble .ui-timer{position:static;margin-left:6px}
.ui-entry{background:#fff3c4;pointer-events:none}
.ui-fumed{background:#ffe0dc;color:#7a1008;font-weight:700;pointer-events:none}
.ui-timer{font-size:12px;color:#c62828}
.ui-answers{position:absolute;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom, 0px) + 12px);display:flex;flex-direction:column;gap:6px;pointer-events:none}
.ui-answer-row{display:flex;flex-direction:column;gap:2px}
.ui-answer-tag{align-self:flex-start;padding:0 8px;border-radius:8px;background:#000b;font-size:11px;font-weight:700;line-height:16px}
.ui-answer-pair{display:flex;flex-wrap:wrap;gap:8px}
.ui-answer{flex:1 1 140px;min-height:46px;box-sizing:border-box;font-size:14px}
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
