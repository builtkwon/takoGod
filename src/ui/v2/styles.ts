// 굽기 조작 개편 오버레이 스타일(기본 CSS 뒤에 붙인다). 끌기·연출 요소는 viewport 좌표를 쓰므로 position:fixed다.
export const CSS_V2 = `
.ui-bar{position:absolute;top:0;left:0;right:0;height:20px;background:#444;border-bottom:2px solid #000}
.ui-bar-zone{position:absolute;top:0;bottom:0;background:#789;opacity:.8}
.ui-bar.active .ui-bar-zone{background:#43d95a;opacity:1;box-shadow:0 0 8px #43d95a}
.ui-bar-marker{position:absolute;top:-2px;bottom:-2px;width:4px;margin-left:-2px;background:#fff}
.ui-hud2{position:absolute;top:22px;left:0;right:0;padding:6px 12px;background:#000a;font-size:14px}
.ui-faces{display:flex;gap:6px;margin-top:4px}
.ui-face{padding:2px 8px;border-radius:10px;background:#3a8a3a}
.ui-face-annoyed{background:#e68a00}.ui-face-angry{background:#d32f2f}
.ui-bucket{position:absolute;top:42%;width:64px;height:64px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;font-size:13px;font-weight:700;touch-action:none}
.ui-bucket-margarine{left:6px;background:#f2d56b;color:#442}
.ui-bucket-batter{right:6px;background:#e9dfc0;color:#442}
.ui-ghost,.ui-mark{position:fixed;left:0;top:0;pointer-events:none;z-index:10}
.ui-ghost{min-width:44px;height:44px;padding:0 6px;box-sizing:border-box;border-radius:22px;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#222;background:#fff}
.ui-ghost-margarine{background:#f2d56b}.ui-ghost-batter{background:#e9dfc0}
.ui-ghost-done{background:#d9993a}.ui-ghost-dark{background:#7a4a1a}.ui-ghost-burnt{background:#1a1a1a}
.ui-mark{font-weight:700;font-size:18px;text-shadow:0 1px 2px #000}
.ui-mark-good{color:#a5d6a7}.ui-mark-bad{color:#ef9a9a}.ui-mark-neutral{color:#fff}
.ui-arrow{position:fixed;height:6px;margin-top:-3px;background:#ffeb3b;transform-origin:0 50%;pointer-events:none;animation:ui-pulse .7s infinite alternate}
.ui-arrow::after{content:"";position:absolute;right:-2px;top:-7px;border-left:14px solid #ffeb3b;border-top:10px solid transparent;border-bottom:10px solid transparent}
.ui-arrow.ui-shake{animation:ui-arrow-shake .4s}
.ui-reveal{position:absolute;top:120px;left:12px;right:12px;max-width:none;text-align:left}
.ui-reveal p{margin:4px 0}
@keyframes ui-pulse{to{opacity:.45}}
@keyframes ui-arrow-shake{25%{translate:-8px 0}75%{translate:8px 0}}
`;
