// 오버레이 스타일. 레이어는 입력을 통과시키고 .ui-hit 요소만 입력을 받는다(아래 렌더 캔버스 입력 보호).
export const CSS = `
.ui-layer{position:absolute;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;overflow:hidden;user-select:none}
.ui-hit{pointer-events:auto}
.ui-layer button{font:inherit;color:inherit;border:2px solid #fff;background:#3a2a1a;border-radius:8px;padding:6px 10px;touch-action:manipulation}
.ui-layer [hidden]{display:none!important}
.ui-hud{position:absolute;top:0;left:0;right:0;padding:8px 12px;background:#000a;font-size:14px}
.ui-hud-row{display:flex;gap:8px;align-items:center;justify-content:space-between}
.ui-gauge{flex:1;height:10px;background:#555;border-radius:5px;overflow:hidden}
.ui-gauge-fill{height:100%;background:#ffb300}
.ui-guide{position:absolute;top:84px;left:12px;right:12px;padding:8px;background:#fff;color:#222;border-radius:8px;text-align:center;font-weight:700}
.ui-warning{position:absolute;top:130px;left:12px;right:12px;padding:8px;background:#c62828;border-radius:8px;text-align:center;font-weight:700}
.ui-toolbar{position:absolute;left:0;right:0;bottom:0;padding:8px 8px calc(8px + env(safe-area-inset-bottom));background:#000b}
.ui-holes,.ui-tools,.ui-tray{display:flex;gap:6px;margin-top:6px}
.ui-tray{position:absolute;left:8px;right:8px;bottom:100%;margin:0 0 6px;padding:6px;background:#000b;border-radius:8px}
.ui-tools button,.ui-tray button{flex:1;min-height:48px;position:relative}
.ui-chip{flex:1}
.ui-chip.on{background:#ffb300;color:#222}
.ui-chip.done{border-color:#7cb342}
.ui-hint::before{content:"▼";position:absolute;top:-30px;left:50%;margin-left:-.5em;font-size:24px;color:#ffeb3b;animation:ui-bob .6s infinite alternate}
.ui-shake{animation:ui-shake .4s}
.ui-bubble{position:absolute;height:76px;box-sizing:border-box;overflow:hidden;left:12px;right:12px;padding:8px 12px;background:#fff;color:#222;border-radius:12px;font-size:15px}
.ui-bubble p{margin:2px 0}
.ui-timer{position:absolute;right:10px;top:6px;font-size:12px;color:#c62828}
.ui-answer{position:absolute;box-sizing:border-box;font-size:14px}
.ui-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#000c;text-align:center}
.ui-title h1{font-size:40px;margin:0}
.ui-big{font-size:22px;padding:12px 36px!important}
.ui-card{background:#fff;color:#222;border-radius:12px;padding:12px 16px;max-width:80%}
.ui-toasts{position:absolute;left:0;right:0;bottom:200px;display:flex;flex-direction:column-reverse;align-items:center;gap:6px}
.ui-stars{color:#ffb300;font-size:24px}
.ui-score{font-size:56px;font-weight:700}
@keyframes ui-bob{to{transform:translateY(8px)}}
@keyframes ui-shake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;
