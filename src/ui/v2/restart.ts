import { hudText } from '../../data';
import { el } from '../dom';

/**
 * 게임 중 다시 하기·튜토리얼 건너뛰기 확인 모달(문구만 다르다). 전체 화면 오버레이(.ui-overlay)라 모달이 열려 있는 동안 아래 조작은 눌리지 않는다.
 * 예 → 모달을 닫고 onYes를 한 번 부른다. 아니오 → 닫기만 한다. 이미 열려 있으면 또 열지 않는다.
 */
export function createRestartConfirm(layer: HTMLElement, onYes: () => void, text: { readonly title: string } = { title: hudText.restartConfirm }): { open(): void; close(): void; isOpen(): boolean } {
  let modal: HTMLElement | null = null;
  const close = (): void => {
    modal?.remove();
    modal = null;
  };
  return {
    close,
    isOpen: () => modal !== null,
    open() {
      if (modal) return;
      const o = el('div', 'ui-overlay ui-hit ui-confirm');
      const yes = el('button', 'ui-big', hudText.restartYes);
      const no = el('button', 'ui-big ui-secondary', hudText.restartNo);
      yes.addEventListener('click', () => {
        close();
        onYes();
      });
      no.addEventListener('click', close);
      o.append(el('h2', '', text.title), yes, no);
      layer.append(o);
      modal = o;
    },
  };
}
