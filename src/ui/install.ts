import { el } from './dom';

export const IOS_INSTALL_DISMISSED_KEY = 'takoyaki:ios-install-dismissed';

export interface InstallEnv {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  /** navigator.standalone (iOS Safari 전용, 없으면 undefined) */
  readonly navigatorStandalone: boolean | undefined;
  /** matchMedia('(display-mode: standalone)').matches */
  readonly displayModeStandalone: boolean;
  /** localStorage를 못 얻으면 null */
  readonly storage: Pick<Storage, 'getItem'> | null;
}

/** iPhone·iPod·iPad, 그리고 데스크톱 UA(Macintosh)를 쓰는 터치 iPadOS. */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** 순수 판별. iOS이고 홈 화면 앱이 아니며 아직 닫지 않았을 때만 true. */
export function shouldShowIosInstall(env: InstallEnv): boolean {
  if (!isIos(env.userAgent, env.maxTouchPoints)) return false;
  if (env.navigatorStandalone === true || env.displayModeStandalone) return false;
  try {
    return env.storage?.getItem(IOS_INSTALL_DISMISSED_KEY) !== '1';
  } catch {
    return true; // 저장소를 못 읽어도 게임은 진행한다
  }
}

/** 닫음 기록. 실패해도 무시한다. */
export function markIosInstallDismissed(storage: Pick<Storage, 'setItem'> | null): void {
  try {
    storage?.setItem(IOS_INSTALL_DISMISSED_KEY, '1');
  } catch {
    // 저장 실패는 다음 실행에 안내가 다시 뜰 뿐이다
  }
}

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** iOS 설치 안내. 조건이 아니면 즉시 resolve, 맞으면 [웹에서 계속하기]를 누를 때 resolve된다. */
export function showIosInstall(layer: HTMLElement): Promise<void> {
  const storage = getStorage();
  const show = shouldShowIosInstall({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
    storage,
  });
  if (!show) return Promise.resolve();
  return new Promise((resolve) => {
    const o = el('div', 'ui-overlay ui-hit ui-install');
    const card = el('div', 'ui-card');
    card.append(el('p', '', '1. Safari 아래의 공유 버튼을 누르세요'), el('p', '', "2. '홈 화면에 추가'를 고르세요"));
    const next = el('button', 'ui-big', '웹에서 계속하기');
    next.addEventListener('click', () => {
      markIosInstallDismissed(storage);
      o.remove();
      resolve();
    });
    o.append(el('h2', '', '홈 화면에 추가하면 전체 화면으로 즐길 수 있어요'), card, next);
    layer.append(o);
  });
}
