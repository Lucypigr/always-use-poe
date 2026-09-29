/**
 * Phones and tablets play in either orientation. The first tap enters fullscreen so the
 * browser's address bar can't appear / disappear and shift the camera; the layout adapts to
 * portrait or landscape through CSS media queries (see styles.css) and the renderer's camera.
 */

type FsDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };

let autoFullscreen = true;

export const isPortrait = (): boolean => matchMedia('(orientation: portrait)').matches;

export const isFullscreen = (): boolean => !!(document.fullscreenElement || (document as FsDocument).webkitFullscreenElement);

export const fullscreenSupported = (): boolean => {
  const el = document.documentElement as FsElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
};

/** Enter fullscreen (must run inside a user gesture). */
export function enterFullscreen(): Promise<boolean> {
  autoFullscreen = true;
  if (isFullscreen()) return Promise.resolve(true);
  const el = document.documentElement as FsElement;
  if (el.requestFullscreen) return el.requestFullscreen({ navigationUI: 'hide' }).then(() => true, () => false);
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

export function installTouchScreen(touchDevice: boolean): void {
  if (!touchDevice) return;
  document.body.classList.add('touch-device');
  // The first tap (a user gesture, as browsers require) goes fullscreen, in either orientation.
  const onTap = () => {
    if (!autoFullscreen || isFullscreen() || !fullscreenSupported()) return;
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
