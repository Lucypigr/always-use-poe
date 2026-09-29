/** Tiny DOM helpers. */

type Attrs = Record<string, string | number | boolean | undefined | ((e: Event) => void)> & { style?: string; class?: string };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function fmt(n: number, digits = 0): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function pct(n: number, digits = 0): string {
  return `${fmt(n, digits)}%`;
}
