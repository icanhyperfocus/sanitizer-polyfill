/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* globals Sanitizer */

import {
  DEFAULT_ALLOWED_ELEMENTS,
  getDefaultConfiguration,
  sanitizeDocFragment,
  _normalizeConfig,
} from "../src/sanitizer.js";

/**
 * This function inserts the `Sanitizer` interface into `window`, if it exists.
 */
function setup() {
  // name of our global object
  const GLOBALNAME = "Sanitizer";

  // name of the innerHTML-setter,
  // https://github.com/WICG/sanitizer-api/issues/100
  // when changing this, also change the function declaration below manually.
  const SETTER_NAME = "setHTML";

  if (typeof window === "undefined") {
    return;
  }
  if (window.isSecureContext) {
    // don't polyfill if already defined
    if (
      typeof window[GLOBALNAME] === "function" &&
      location.hash.indexOf("mustpolyfill") === -1
    ) {
      console.warn("Sanitizer is already defined. Bailing out.");
      return;
    }
    //
    const sanitizer = function Sanitizer(config) {
      let normalizedConfig = _normalizeConfig(config);
      Object.assign(this, {
        sanitizeFor(localName, input) {
          // The inactive document does not issue requests and does not execute scripts.
          const inactiveDocument = document.implementation.createHTMLDocument();
          if (!DEFAULT_ALLOWED_ELEMENTS.has(localName)) {
            throw new SanitizerError(
              `${localName} is not an element in built-in default allow list`
            );
          }
          const context = inactiveDocument.createElement(localName);
          context.innerHTML = input;
          sanitizeDocFragment(this.getConfiguration(), context);
          return context;
        },
        getConfiguration() {
          return normalizedConfig;
        },
      });
      Object.freeze(this);
    };
    sanitizer.getDefaultConfiguration = function () {
      return getDefaultConfiguration();
    };
    window[GLOBALNAME] = sanitizer;
    HTMLElement.prototype[SETTER_NAME] = function setHTML(input, opt) {
      let sanitizerObj = opt && opt.sanitizer;
      if (
        !sanitizerObj ||
        typeof sanitizerObj.getConfiguration !== "function"
      ) {
        sanitizerObj = new Sanitizer();
      }
      const inactiveDocument = document.implementation.createHTMLDocument();
      const context = inactiveDocument.createElement(this.localName);
      context.innerHTML = input;
      sanitizeDocFragment(sanitizerObj.getConfiguration(), context);
      this.replaceChildren(context);
    };
  }
}

class SanitizerError extends Error {
  constructor(message) {
    super(message);
    this.name = "SanitizerError";
  }
}

setup();
