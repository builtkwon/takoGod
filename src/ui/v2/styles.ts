// 굽기 조작 개편 오버레이 스타일(기본 CSS 뒤에 붙인다). 끌기·연출 요소는 viewport 좌표를 쓰므로 position:fixed다.
export const CSS_V2 = `
.ui-top{position:absolute;top:0;left:0;right:0}
.ui-bar{position:relative;height:44px;background:#1b1b1b;border-bottom:3px solid #000;box-shadow:inset 0 0 0 2px #888;box-sizing:border-box}
.ui-bar-zone{position:absolute;top:4px;bottom:4px;border:2px solid #fff;border-radius:4px;box-sizing:border-box;display:flex;justify-content:center;color:#052;font-weight:700;font-size:14px;line-height:14px}
.ui-bar-zone-w1{background:#2ee04d;border-color:#eaffea;align-items:flex-start;box-shadow:0 0 10px #2ee04d}
.ui-bar-zone-w2{background:#35c4ff;border-color:#e6f8ff;border-style:dashed;align-items:flex-end;box-shadow:0 0 10px #35c4ff}
.ui-bar-flash{animation:ui-bar-flash .5s ease-out}
.ui-bar-marker{position:absolute;top:0;bottom:0;width:8px;margin-left:-4px;background:#ffeb3b;border:2px solid #000;box-sizing:border-box;border-radius:2px;box-shadow:0 0 6px #fff}
.ui-hud2{padding:6px 12px;background:#000c;font-size:14px;box-sizing:border-box}
.ui-faces{display:flex;gap:6px;margin-top:4px;min-height:22px}
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
.ui-mark{font-weight:900;font-size:30px;line-height:34px;white-space:nowrap;-webkit-text-stroke:5px #000;paint-order:stroke fill;text-shadow:0 2px 4px #000}
.ui-mark-good{color:#7dff8a}.ui-mark-bad{color:#ff7a7a}.ui-mark-neutral{color:#fff}
.ui-arrow{position:fixed;height:6px;margin-top:-3px;background:#ffeb3b;transform-origin:0 50%;pointer-events:none;animation:ui-pulse .7s infinite alternate}
.ui-arrow::after{content:"";position:absolute;right:-2px;top:-7px;border-left:14px solid #ffeb3b;border-top:10px solid transparent;border-bottom:10px solid transparent}
.ui-arrow.ui-shake{animation:ui-arrow-shake .4s}
.ui-reveal{position:absolute;top:152px;left:12px;right:12px;max-width:none;text-align:left}
.ui-reveal p{margin:4px 0}
@keyframes ui-bar-flash{0%{background:#fff;box-shadow:0 0 0 6px #fff,0 0 18px 6px #ffeb3b;transform:scaleY(1.25)}60%{background:#ffeb3b}100%{transform:scaleY(1)}}
.ui-arrow-label{position:fixed;left:0;top:0;pointer-events:none;z-index:6;padding:3px 10px;border-radius:12px;background:#000c;border:2px solid #ffeb3b;color:#fff;font-size:15px;font-weight:700;white-space:nowrap}
.ui-star-row{display:inline-flex;gap:1px;font-size:18px;line-height:1}
.ui-star{position:relative;display:inline-block;color:#555}
.ui-star::before{content:'★';position:absolute;left:0;top:0;width:0;overflow:hidden;color:#ffb300}
.ui-star[data-fill="full"]::before{width:100%}
.ui-star[data-fill="half"]::before{width:50%}
.ui-card .ui-star-row{font-size:22px}
.ui-card:not(.ui-reveal){position:relative}
.ui-card-stars{position:absolute;top:8px;right:12px}
@keyframes ui-pulse{to{opacity:.45}}
@keyframes ui-arrow-shake{25%{translate:-8px 0}75%{translate:8px 0}}
`;
