(function exposeTextareaAutosize(root, factory) {
  const autosize = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = autosize;
  } else {
    root.RPA_TEXTAREA_AUTOSIZE = autosize;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const boundTextareas = new WeakSet();

  function assertTextarea(textarea) {
    if (!textarea || !textarea.style) {
      throw new TypeError('A textarea-like element with a style object is required');
    }
  }

  function resizeTextarea(textarea) {
    assertTextarea(textarea);
    textarea.style.height = 'auto';
    const contentHeight = Number(textarea.scrollHeight);

    // Closed accordion bodies cannot be measured. Leave the textarea at its
    // CSS minimum until the section becomes visible and is measured again.
    if (Number.isFinite(contentHeight) && contentHeight > 0) {
      const view = textarea.ownerDocument && textarea.ownerDocument.defaultView;
      const computed = view && typeof view.getComputedStyle === 'function'
        ? view.getComputedStyle(textarea)
        : null;
      const borderHeight = computed
        ? (parseFloat(computed.borderTopWidth) || 0)
          + (parseFloat(computed.borderBottomWidth) || 0)
        : 0;

      textarea.style.height = Math.ceil(contentHeight + borderHeight) + 'px';
    }

    return contentHeight;
  }

  function bindTextarea(textarea) {
    assertTextarea(textarea);

    if (!boundTextareas.has(textarea)) {
      textarea.addEventListener('input', () => resizeTextarea(textarea));
      boundTextareas.add(textarea);
    }

    resizeTextarea(textarea);
    return textarea;
  }

  function textareasWithin(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    return Array.from(root.querySelectorAll('textarea'));
  }

  function bindTextareas(root) {
    const textareas = textareasWithin(root);
    textareas.forEach(bindTextarea);
    return textareas;
  }

  function resizeTextareas(root) {
    const textareas = textareasWithin(root);
    textareas.forEach(resizeTextarea);
    return textareas;
  }

  return { bindTextarea, bindTextareas, resizeTextarea, resizeTextareas };
});
