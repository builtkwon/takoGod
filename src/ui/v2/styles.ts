// 굽기 조작 개편 오버레이 스타일(기본 CSS 뒤에 붙인다). 끌기·연출 요소는 viewport 좌표를 쓰므로 position:fixed다.
import { Z } from '../z';

export const CSS_V2 = `
.ui-top{position:absolute;top:0;left:0;right:0}
.ui-bar{position:relative;height:44px;background:#1b1b1b;border-bottom:3px solid #000;box-shadow:inset 0 0 0 2px #888;box-sizing:border-box}
.ui-bar-zone{position:absolute;top:4px;bottom:4px;border:2px solid #fff;border-radius:4px;box-sizing:border-box;display:flex;justify-content:center;color:#052;font-weight:700;font-size:14px;line-height:14px}
.ui-bar-zone-w1{background:#2ee04d;border-color:#eaffea;align-items:flex-start;box-shadow:0 0 10px #2ee04d}
.ui-bar-zone-w2{background:#35c4ff;border-color:#e6f8ff;border-style:dashed;align-items:flex-end;box-shadow:0 0 10px #35c4ff}
.ui-bar-flash{animation:ui-bar-flash .5s ease-out}
.ui-bar-marker{position:absolute;top:0;bottom:0;width:8px;margin-left:-4px;background:#ffeb3b;border:2px solid #000;box-sizing:border-box;border-radius:2px;box-shadow:0 0 6px #fff}
.ui-hud2{padding:6px 12px;background:#000c;font-size:14px;box-sizing:border-box}
.ui-hud-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:start;gap:8px}
.ui-hud-left{display:flex;flex-direction:column;align-items:flex-start;gap:2px;font-weight:700}
.ui-hud-best-row{display:flex;align-items:center;gap:6px}
.ui-hud-fumed{font-size:12px;display:inline-block}
.ui-hud-fumed.ui-dim{opacity:.4}
.ui-hud-fumed.ui-shake-s{animation:ui-shake-s .4s}
.ui-hud-new{padding:0 5px;border-radius:6px;background:#ffeb3b;color:#b00020;font-size:12px;font-weight:900;animation:ui-new-blink .6s steps(2) infinite}
.ui-hud-center{position:relative;text-align:center;line-height:1.1}
.ui-hud-phase{font-size:13px;opacity:.85}
.ui-hud-score{font-size:28px;font-weight:900;display:inline-block}
.ui-hud-score.ui-bump{animation:ui-bump .3s ease-out}
.ui-hud-right{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.ui-hud-reviews{font-size:11px;opacity:.8}
.ui-score-pop{position:absolute;left:50%;top:100%;transform:translateX(-50%);z-index:${Z.SCORE_POP};display:flex;flex-direction:column;align-items:center;pointer-events:none;white-space:nowrap;color:#ffeb3b;font-weight:900;font-size:22px;-webkit-text-stroke:4px #000;paint-order:stroke fill;animation:ui-pop 1.3s ease-out forwards}
.ui-score-combo{font-size:15px;color:#7dff8a}
.ui-shop-score{font-size:36px;font-weight:900}
.ui-new-best{font-size:28px;font-weight:900;color:#ffeb3b;animation:ui-new-blink .6s steps(2) infinite}
.ui-faces{display:flex;gap:6px;margin-top:4px;min-height:22px}
.ui-face{padding:2px 8px;border-radius:10px;background:#3a8a3a}
.ui-face-annoyed{background:#e68a00}.ui-face-angry{background:#d32f2f}
.ui-bucket{position:absolute;top:42%;width:64px;height:64px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;font-size:13px;font-weight:700;touch-action:none}
.ui-bucket-margarine{left:6px;background:#f2d56b;color:#442}
.ui-bucket-batter{right:6px;background:#e9dfc0;color:#442}
.ui-ghost,.ui-mark{position:fixed;left:0;top:0;pointer-events:none;z-index:${Z.FLOAT}}
.ui-ghost{width:44px;height:44px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 2px #000a)}
.ui-ghost svg{display:block}
.ui-tray-label{position:fixed;left:0;top:0;pointer-events:none;z-index:${Z.TRAY_LABEL};padding:1px 6px;border-radius:8px;background:#000a;color:#fff;font-size:11px;line-height:14px;white-space:nowrap}
.ui-tray-label[hidden]{display:none}
.ui-tray-label-selected{background:#ffeb3b;color:#000;font-weight:700}
.ui-tray-ring{position:fixed;left:0;top:0;width:38px;height:38px;box-sizing:border-box;border:3px solid #ffeb3b;border-radius:50%;box-shadow:0 0 8px #ffeb3b;pointer-events:none;z-index:${Z.TRAY_LABEL}}
.ui-tray-ring[hidden]{display:none}
.ui-mark{font-weight:900;font-size:30px;line-height:34px;white-space:nowrap;-webkit-text-stroke:5px #000;paint-order:stroke fill;text-shadow:0 2px 4px #000}
.ui-mark-good{color:#7dff8a}.ui-mark-bad{color:#ff7a7a}.ui-mark-neutral{color:#fff}
.ui-arrow{position:fixed;height:6px;margin-top:-3px;background:#ffeb3b;transform-origin:0 50%;pointer-events:none;animation:ui-pulse .7s infinite alternate}
.ui-arrow::after{content:"";position:absolute;right:-2px;top:-7px;border-left:14px solid #ffeb3b;border-top:10px solid transparent;border-bottom:10px solid transparent}
.ui-arrow.ui-shake{animation:ui-arrow-shake .4s}
.ui-reveal{position:absolute;top:var(--ui-reveal-top,152px);left:12px;right:12px;max-width:none;text-align:left}
.ui-reveal p{margin:4px 0}
@keyframes ui-bar-flash{0%{background:#fff;box-shadow:0 0 0 6px #fff,0 0 18px 6px #ffeb3b;transform:scaleY(1.25)}60%{background:#ffeb3b}100%{transform:scaleY(1)}}
.ui-arrow-label{position:fixed;left:0;top:0;pointer-events:none;z-index:${Z.ARROW_LABEL};padding:3px 10px;border-radius:12px;background:#000c;border:2px solid #ffeb3b;color:#fff;font-size:15px;font-weight:700;white-space:nowrap}
.ui-star-row{display:inline-flex;gap:1px;font-size:18px;line-height:1}
.ui-star{position:relative;display:inline-block;color:#555}
.ui-star::before{content:'★';position:absolute;left:0;top:0;width:0;overflow:hidden;color:#ffb300}
.ui-star[data-fill="full"]::before{width:100%}
.ui-star[data-fill="half"]::before{width:50%}
.ui-card .ui-star-row{font-size:22px}
.ui-card:not(.ui-reveal){position:relative}
.ui-card-stars{position:absolute;top:8px;right:12px}
@keyframes ui-new-blink{50%{opacity:.35}}
@keyframes ui-bump{40%{transform:scale(1.35)}}
@keyframes ui-pop{0%{opacity:0;transform:translate(-50%,0)}15%{opacity:1}80%{opacity:1}100%{opacity:0;transform:translate(-50%,18px)}}
@keyframes ui-shake-s{20%{transform:translateX(-5px)}60%{transform:translateX(5px)}}
@keyframes ui-pulse{to{opacity:.45}}
@keyframes ui-arrow-shake{25%{translate:-8px 0}75%{translate:8px 0}}
`;
