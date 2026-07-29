// @ts-check

// Set the bypass flag first so the polyfill always installs itself, even if
// replacing the (possibly native) `ariaNotify` property below fails. If this
// assignment ran after the loop and the loop threw, the flag would be left
// unset and the polyfill would defer to the browser's native `ariaNotify` — the
// exact thing these tests need to avoid.
/** @type {typeof globalThis & {__bypassNativeAriaNotify?: boolean}} */ (
  globalThis
).__bypassNativeAriaNotify = true;

for (const prototype of [Element.prototype, Document.prototype]) {
  const value = function () {
    throw new Error("Expected tests to use the ariaNotify polyfill");
  };
  try {
    Object.defineProperty(prototype, "ariaNotify", {
      configurable: true,
      writable: true,
      value,
    });
  } catch {
    // `Object.defineProperty` throws if a native `ariaNotify` property is not
    // configurable. Fall back to assignment, which still works for writable
    // (data) properties, so the guard is installed wherever possible.
    try {
      // @ts-ignore - `value` intentionally throws when the guard is invoked.
      prototype.ariaNotify = value;
    } catch {}
  }
}
