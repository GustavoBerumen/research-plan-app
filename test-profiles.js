(() => {
  'use strict';

  // Two versions of the same project context for calibrating the evaluator.
  // They are intentionally not tied to expected colour bands: the observed
  // scores will be used to tune Claude's evaluation parameters.
  window.TEST_PROFILES = Object.freeze({
    experienced: {
      label: 'Experienced researcher',
      fields: {
        background: 'Mobile checkout abandonment rose from 61% to 68% after the June redesign. Support contacts identify confusion at the payment step, where customers select a payment method and enter billing details. Before Q4 planning, the product team must determine which interactions cause new mobile shoppers to leave.',
        goal: 'Reduce mobile checkout abandonment from 68% to below 60% by replacing the current payment step with a shorter, clearer flow before the Q4 release.',
        problem: 'New mobile shoppers abandon 68% of checkout sessions while selecting a payment method or entering billing details, costing approximately 1,200 orders per month. This study will focus only on those two payment-step interactions.',
      },
    },
    novice: {
      label: 'Novice researcher',
      fields: {
        background: 'Online shopping is important and mobile use continues to grow. Our checkout has some problems and customers have complained, so we want to research it.',
        goal: 'Research the checkout and find out what users think so we can make it better.',
        problem: 'Users do not like the checkout and it is causing problems for the business.',
      },
    },
  });
})();
