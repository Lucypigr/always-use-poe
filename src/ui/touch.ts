/**
 * Touch-screen support helpers. Phones and tablets get a virtual joystick, touch skill
 * buttons and an item-action toolbar instead of the mouse's right-click / Ctrl-click.
 */

let lastTouch = -1e9;

const mark = () => (lastTouch = performance.now());
window.addEventListener('touchstart', mark, { capture: true, passive: true });
window.addEventListener('touchend', mark, { capture: true, passive: true });
window.addEventListener('pointerdown', (e) => e.pointerType === 'touch' && mark(), { capture: true });

/** True on devices whose primary pointer is a finger. */
export const isTouchDevice = (): boolean =>
  matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches);

/** True if the current (possibly emulated) mouse event was produced by a recent touch. */
export const fromTouch = (): boolean => performance.now() - lastTouch < 900;

/** What a tap on an item does while playing with touch (mouse buttons / modifiers equivalent). */
export type TouchItemMode = 'take' | 'use' | 'quick' | 'inspect';

export const TOUCH_MODES: { id: TouchItemMode; label: string; hint: string }[] = [
  { id: 'take', label: '拿取', hint: '點擊拿起 / 放下物品（左鍵）' },
  { id: 'use', label: '使用', hint: '使用通貨、裝備物品、取出寶石（右鍵）' },
  { id: 'quick', label: '快速移動', hint: '在背包與倉庫 / 商人之間移動（Ctrl+點擊）' },
  { id: 'inspect', label: '查看', hint: '只顯示物品說明' },
];
