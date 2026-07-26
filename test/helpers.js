"use strict";
// Minimal DOM/window shim so src/content.js can be loaded in Node for testing.
// Require this BEFORE requiring ../src/content.js.
//
// content.js resolves `page = unsafeWindow || window`; with `window` shimmed to a
// plain object, `page` becomes that object and the console helpers attach to it.
// `document.body` is left falsy so the IIFE takes the addEventListener branch and
// does NOT auto-run boot() (no timers, no DOM building) at require time.

function installDomShim() {
  if (global.window) return global.window;

  const noop = () => {};
  const element = () => ({
    style: {},
    setAttribute: noop,
    getAttribute: () => null,
    appendChild: noop,
    removeChild: noop,
    remove: noop,
    addEventListener: noop,
    click: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
  });

  global.window = {};
  global.document = {
    body: null,
    addEventListener: noop,
    createElement: element,
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  return global.window;
}

module.exports = { installDomShim };
