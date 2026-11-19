// 굽기 조작 개편 오버레이 스타일(기본 CSS 뒤에 붙인다). 끌기·연출 요소는 viewport 좌표를 쓰므로 position:fixed다.
export const CSS_V2 = `
.ui-bar{position:absolute;top:0;left:0;right:0;height:44px;background:#1b1b1b;border-bottom:3px solid #000;box-shadow:inset 0 0 0 2px #888;box-sizing:border-box}
.ui-bar-zone{position:absolute;top:4px;bottom:4px;background:#6d8fb0;border:2px solid #fff;border-radius:4px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;text-shadow:0 1px 2px #000}
.ui-bar[data-step="2"] .ui-bar-zone{border-style:dashed}
.ui-bar.active .ui-bar-zone{background:#2ee04d;border-color:#eaffea;color:#052;text-shadow:none;box-shadow:0 0 12px #2ee04d}
.ui-bar-marker{position:absolute;top:0;bottom:0;width:8px;margin-left:-4px;background:#ffeb3b;border:2px solid #000;box-sizing:border-box;border-radius:2px;box-shadow:0 0 6px #fff}
.ui-hud2{position:absolute;top:46px;left:0;right:0;padding:6px 12px;background:#000a;font-size:14px}
.ui-faces{display:flex;gap:6px;margin-top:4px}
.ui-face{padding:2px 8px;border-radius:10px;background:#3a8a3a}
.ui-face-annoyed{background:#e68a00}.ui-face-angry{background:#d32f2f}
.ui-bucket{position:absolute;top:42%;width:64px;height:64px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;font-size:13px;font-weight:700;touch-action:none}
.ui-bucket-margarine{left:6px;background:#f2d56b;color:#442}
.ui-bucket-batter{right:6px;background:#e9dfc0;color:#442}
.ui-ghost,.ui-mark{position:fixed;left:0;top:0;pointer-events:none;z-index:10}
.ui-ghost{width:44px;height:44px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 2px #000a)}
.ui-ghost svg{display:block}
.ui-tray-label{position:fixed;left:0;top:0;pointer-events:none;z-index:5;padding:1px 6px;border-radius:8px;background:#000a;color:#fff;font-size:11px;line-height:14px;white-space:nowrap}
.ui-tray-label[hidden]{display:none}
.ui-mark{font-weight:700;font-size:18px;text-shadow:0 1px 2px #000}
.ui-mark-good{color:#a5d6a7}.ui-mark-bad{color:#ef9a9a}.ui-mark-neutral{color:#fff}
.ui-arrow{position:fixed;height:6px;margin-top:-3px;background:#ffeb3b;transform-origin:0 50%;pointer-events:none;animation:ui-pulse .7s infinite alternate}
.ui-arrow::after{content:"";position:absolute;right:-2px;top:-7px;border-left:14px solid #ffeb3b;border-top:10px solid transparent;border-bottom:10px solid transparent}
.ui-arrow.ui-shake{animation:ui-arrow-shake .4s}
.ui-reveal{position:absolute;top:144px;left:12px;right:12px;max-width:none;text-align:left}
.ui-reveal p{margin:4px 0}
@keyframes ui-pulse{to{opacity:.45}}
@keyframes ui-arrow-shake{25%{translate:-8px 0}75%{translate:8px 0}}
`;
