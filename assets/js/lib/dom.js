// Small shared helpers.
export const $ = (q, el = document) => el.querySelector(q);
export const $$ = (q, el = document) => [...el.querySelectorAll(q)];
export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const API = "/api";

/** Phone-sized layout (matches the 760px breakpoint in the CSS). */
export const isSmall = () => innerWidth < 760;

export const fmt = (n, cur) =>
  `${cur} ${Number(n).toLocaleString("en-GH", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "style") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...kids.filter((k) => k != null));
  return el;
}

/** Debounced resize listener that only fires when the width really changes
    (phones fire resize when the address bar slides in and out). */
export function onResize(fn, wait = 200) {
  let t, w = innerWidth, hgt = innerHeight;
  addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const dw = Math.abs(innerWidth - w), dh = Math.abs(innerHeight - hgt);
      if (dw < 1 && dh < 120) return;
      w = innerWidth; hgt = innerHeight;
      fn();
    }, wait);
  });
}
