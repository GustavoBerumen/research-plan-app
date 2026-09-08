/* Browser-only fixture: populate and operate the real form through its controls. */
(() => {
  'use strict';
  localStorage.removeItem('research-plan-app:draft');
  const scenario = new URLSearchParams(location.search).get('scenario') || 'guardrail';
  const mode = document.getElementById('fixture-mode');
  if (['ready', 'guardrail'].includes(scenario)) mode.value = scenario;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (url, init) => {
    if (url === '/api/evaluate' || url === '/api/calibration') {
      let selected = mode.value;
      if (selected === 'save-failure' && url === '/api/evaluate') selected = scenario;
      if (selected === 'guardrail') selected = scenario;
      url += '?scenario=' + encodeURIComponent(selected);
    }
    return originalFetch(url, init);
  };
  const wait = async predicate => {
    for (let i = 0; i < 1000; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 20)); }
    throw new Error('Preview setup timed out');
  };
  const setValue = (input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
  const controls = key => (document.querySelector('[data-field="' + key + '"]') || document.querySelector('[data-list-key="' + key + '"]')).closest('.field').querySelector('.eval-controls');
  document.addEventListener('DOMContentLoaded', async () => {
    await wait(() => document.querySelector('[data-field="background"]'));
    for (const key of ['background', 'researchQuestions']) {
      const section = controls(key).closest('.acc');
      if (section.querySelector('.acc-body').hidden) section.querySelector('.acc-head').click();
    }
    setValue(document.querySelector('[data-field="background"]'), 'Checkout research will examine where returning customers hesitate before payment. Support interviews describe uncertainty about delivery dates; analytics show repeated visits to the delivery information page.');
    const questionField = document.querySelector('[data-list-key="researchQuestions"]').closest('.field');
    questionField.querySelector('.add-btn').click(); questionField.querySelector('.add-btn').click();
    ['researchQuestions', 'outcomes'].forEach(key => {
      const inputs = document.querySelectorAll('[data-list-key="' + key + '"] > .list-row > .list-input');
      setValue(inputs[0], key === 'outcomes' ? 'A prioritised report of checkout delivery-information barriers.' : 'How do returning customers use delivery information when deciding whether to complete checkout?');
      setValue(inputs[2], key === 'outcomes' ? 'An evidence-based comparison of delivery-information needs to guide the next design decision.' : 'Which delivery details do customers need before they can confidently place their order?');
    });
    controls('background').closest('.acc').querySelector('.section-eval-btn').click();
    controls('researchQuestions').closest('.acc').querySelector('.section-eval-btn').click();
    await wait(() => ['background', 'researchQuestions', 'outcomes'].every(key => controls(key).querySelector('.eval-badge').textContent && !controls(key).querySelector('.eval-reevaluate-btn').disabled));
    ['background', 'researchQuestions', 'outcomes'].forEach(key => controls(key).querySelector('.eval-result-btn').click());
    document.documentElement.dataset.fixtureReady = 'true';
  });
})();
