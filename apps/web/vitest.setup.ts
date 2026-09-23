import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement these — Radix UI's Select/Dialog call them internally.
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.hasPointerCapture ??= () => false;
  window.HTMLElement.prototype.setPointerCapture ??= () => undefined;
  window.HTMLElement.prototype.releasePointerCapture ??= () => undefined;
  window.HTMLElement.prototype.scrollIntoView ??= () => undefined;
}
