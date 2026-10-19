import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// jsdom does not implement HTMLDialogElement.showModal/close, so stub them
// with the open-attribute behaviour the components rely on.
const proto = window.HTMLDialogElement.prototype;
if (typeof proto.showModal !== 'function') {
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
}
if (typeof proto.close !== 'function') {
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}
