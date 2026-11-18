import { describe, expect, it } from 'vitest';
import { IOS_INSTALL_DISMISSED_KEY, markIosInstallDismissed, shouldShowIosInstall, type InstallEnv } from '../install';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

const store = (value: string | null): Pick<Storage, 'getItem'> => ({ getItem: () => value });
const env = (over: Partial<InstallEnv> = {}): InstallEnv => ({
  userAgent: IPHONE,
  maxTouchPoints: 5,
  navigatorStandalone: false,
  displayModeStandalone: false,
  storage: store(null),
  ...over,
});

describe('shouldShowIosInstall', () => {
  it('iPhone Safari는 보여준다', () => expect(shouldShowIosInstall(env())).toBe(true));
  it('데스크톱 UA의 터치 iPad는 보여준다', () => expect(shouldShowIosInstall(env({ userAgent: IPAD_DESKTOP }))).toBe(true));
  it('터치 없는 Mac은 보여주지 않는다', () => expect(shouldShowIosInstall(env({ userAgent: IPAD_DESKTOP, maxTouchPoints: 0 }))).toBe(false));
  it('Android는 보여주지 않는다', () => expect(shouldShowIosInstall(env({ userAgent: ANDROID }))).toBe(false));
  it('navigator.standalone이면 보여주지 않는다', () => expect(shouldShowIosInstall(env({ navigatorStandalone: true }))).toBe(false));
  it('display-mode standalone이면 보여주지 않는다', () => expect(shouldShowIosInstall(env({ displayModeStandalone: true }))).toBe(false));
  it('이미 닫았으면 보여주지 않는다', () => expect(shouldShowIosInstall(env({ storage: store('1') }))).toBe(false));
  it('storage가 없으면 보여준다', () => expect(shouldShowIosInstall(env({ storage: null }))).toBe(true));
  it('storage 읽기가 예외여도 보여준다', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
    };
    expect(shouldShowIosInstall(env({ storage: throwing }))).toBe(true);
  });
});

describe('markIosInstallDismissed', () => {
  it('키에 1을 저장한다', () => {
    const saved: Record<string, string> = {};
    markIosInstallDismissed({ setItem: (k, v) => void (saved[k] = v) });
    expect(saved).toEqual({ [IOS_INSTALL_DISMISSED_KEY]: '1' });
  });
  it('쓰기 예외와 null storage를 삼킨다', () => {
    expect(() =>
      markIosInstallDismissed({
        setItem: () => {
          throw new Error('quota');
        },
      }),
    ).not.toThrow();
    expect(() => markIosInstallDismissed(null)).not.toThrow();
  });
});
