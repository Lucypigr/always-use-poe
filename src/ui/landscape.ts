import { h } from './dom';
import { isTouchDevice } from './touch';

/**
 * Phones and tablets are played in landscape only. While the device is held upright a
 * blocking overlay asks the player to rotate it (and the game pauses). In landscape the
 * first tap enters fullscreen and locks the orientation, so the browser's address bar
 * can't appear / disappear and shift the camera.
 */

type FsDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };

let autoFullscreen = true;
let touchDevice = false;

export const isPortrait = (): boolean => matchMedia('(orientation: portrait)').matches;

/** True when the game should pause because a touch device is held upright. */
export const mustRotate = (): boolean => touchDevice && isPortrait();

export const isFullscreen = (): boolean => !!(document.fullscreenElement || (document as FsDocument).webkitFullscreenElement);

export const fullscreenSupported = (): boolean => {
  const el = document.documentElement as FsElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
};

function lockLandscape(): void {
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  o?.lock?.('landscape').catch(() => {});
}

/** Enter fullscreen (must run inside a user gesture) and lock to landscape where supported. */
export function enterFullscreen(): Promise<boolean> {
  autoFullscreen = true;
  if (isFullscreen()) {
    lockLandscape();
    return Promise.resolve(true);
  }
  const el = document.documentElement as FsElement;
  if (el.requestFullscreen) {
    return el.requestFullscreen({ navigationUI: 'hide' }).then(
      () => (lockLandscape(), true),
      () => false,
    );
  }
  if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}

/** Leave fullscreen and stop re-entering it automatically. */
export function exitFullscreen(): void {
  autoFullscreen = false;
  const d = document as FsDocument;
  if (!isFullscreen()) return;
  if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  else d.webkitExitFullscreen?.();
}

/** Resize handlers run before some browsers finish rotating; nudge them again afterwards. */
function settle(): void {
  for (const ms of [120, 400]) setTimeout(() => window.dispatchEvent(new Event('resize')), ms);
}

export function installLandscapeGuard(): void {
  touchDevice = isTouchDevice();
  if (!touchDevice) return;
  document.body.classList.add('touch-device');

  const note = h('p', { class: 'pb-note' });
  const btn = h('button', {
    onclick: () => {
      enterFullscreen().then((ok) => {
        if (!ok) note.textContent = '此瀏覽器無法自動旋轉，請手動將手機橫放（並關閉螢幕方向鎖定）。';
      });
    },
  }, '進入全螢幕並橫放');
  const block = h('div', { class: 'portrait-block' },
    h('div', { class: 'pb-phone' }),
    h('h2', {}, '請將手機橫放'),
    h('p', {}, '本遊戲只支援橫向畫面。旋轉手機後即可繼續遊戲。'),
    fullscreenSupported() ? btn : h('p', { class: 'pb-note' }, 'iPhone 可將網頁「加入主畫面」，以全螢幕方式遊玩。'),
    note,
  );
  document.body.append(block);

  // In landscape, the first tap (a user gesture, as browsers require) goes fullscreen.
  const onTap = () => {
    if (!autoFullscreen || isFullscreen() || isPortrait() || !fullscreenSupported()) return;
    enterFullscreen();
  };
  window.addEventListener('touchend', onTap, { capture: true, passive: true });
  window.addEventListener('orientationchange', settle);
  screen.orientation?.addEventListener?.('change', settle);
  document.addEventListener('fullscreenchange', settle);
  document.addEventListener('webkitfullscreenchange', settle);
  window.visualViewport?.addEventListener('resize', () => window.dispatchEvent(new Event('resize')));
  // iOS Safari ignores user-scalable=no for pinch gestures; keep the page itself from zooming.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}
