(function exposePlanModel(root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = model;
  } else {
    root.RPA_PLAN_MODEL = model;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  // RPA-46, first slice. The plan as information rather than as a page: the
  // parts that are linked to each other, and the rules that link them, with
  // no DOM anywhere.
  //
  // Two relationships run through this plan, and until now both were read
  // back out of the page by counting elements. Outcome N answers Question N,
  // and Methods are grouped one per question. Positional DOM lookups are a
  // fragile place for a rule to live: every reader has to count the same way,
  // and nothing fails loudly when one of them counts differently. Here the
  // rule is stated once and the page renders from it.
  //
  // Nothing about display lives here — no labels a person reads, no markup.
  // That keeps this usable by the form, by the draft, by evaluation, and by
  // the printed document when it is rebuilt to render from the plan rather
  // than from the form's own DOM.

  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const list = (value) => (Array.isArray(value) ? value : []);

  // Position is identity. A row left blank keeps its place, so the numbering
  // never shifts underneath the pairing: answering question three later must
  // not turn the outcome written for it into the answer to question two.
  function numbered(values) {
    return list(values).map((value, index) => ({ number: index + 1, text: text(value) }));
  }
  function answered(values) {
    return numbered(values).filter((entry) => entry.text);
  }

  function hasAnyQuestion(questions) {
    return numbered(questions).some((entry) => entry.text);
  }
  // One methods group per question, and one to write in before there are any
  // questions at all: an empty plan still offers somewhere to start.
  function groupCount(questions) {
    return hasAnyQuestion(questions) ? list(questions).length : 1;
  }
  // Outcomes track questions row for row, not answer for answer: a question
  // still to be written already has the outcome row that will answer it.
  function outcomeCount(questions) {
    return list(questions).length;
  }
  // What a question is called when it is referred to from somewhere else.
  function questionNumber(index) {
    return 'RQ' + (index + 1);
  }

  // The linked view: one item per question, carrying the outcome that answers
  // it and the methods group that serves it. One item for an empty plan, so
  // a reader never has to special-case nothing.
  function link(parts) {
    const source = parts || {};
    const questions = numbered(source.questions);
    const outcomes = numbered(source.outcomes);
    const groups = list(source.methods);
    const count = Math.max(questions.length, 1);
    const items = [];
    for (let index = 0; index < count; index++) {
      const group = groups[index] || {};
      items.push({
        number: index + 1,
        label: questionNumber(index),
        question: questions[index] ? questions[index].text : '',
        outcome: outcomes[index] ? outcomes[index].text : '',
        methods: list(group.methods).slice(),
        characteristics: list(group.characteristics).slice(),
        userGroups: list(group.userGroups).slice(),
        sampleSize: group.sampleSize || null,
      });
    }
    return items;
  }
  // The same view, taken from a saved draft.
  function linksOf(draft) {
    const lists = (draft && draft.lists) || {};
    return link({ questions: lists.researchQuestions, outcomes: lists.outcomes, methods: draft && draft.methods });
  }

  return { numbered, answered, hasAnyQuestion, groupCount, outcomeCount, questionNumber, link, linksOf };
});
