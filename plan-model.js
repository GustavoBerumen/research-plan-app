(function exposePlanModel(root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = model;
  } else {
    root.RPA_PLAN_MODEL = model;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  // RPA-46, first slice, and RPA-142. The plan as information rather than as
  // a page: the parts that are linked to each other, and the rules that link
  // them, with no DOM anywhere.
  //
  // Three relationships run through this plan. Outcome N answers Question N.
  // A study answers one or more questions, and a question may be answered by
  // more than one study. Methods, Characteristics, User Groups and Sample
  // Size belong to a study, not to a question (RPA-142, Gus's decisions of
  // 16 September 2026). Positional DOM lookups are a fragile place for a
  // rule to live: every reader has to count the same way, and nothing fails
  // loudly when one of them counts differently. Here each rule is stated
  // once and the page renders from it.
  //
  // Nothing about display lives here — no labels a person reads, no markup.
  // That keeps this usable by the form, by the draft, by evaluation, and by
  // the printed document when it is rebuilt to render from the plan rather
  // than from the form's own DOM.

  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const list = (value) => (Array.isArray(value) ? value : []);
  const record = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

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
  // Outcomes track questions row for row, not answer for answer: a question
  // still to be written already has the outcome row that will answer it.
  function outcomeCount(questions) {
    return list(questions).length;
  }
  // What a question is called when it is referred to from somewhere else.
  function questionNumber(index) {
    return 'RQ' + (index + 1);
  }

  // ---------- studies (RPA-142) ----------
  // A study is what Methodology is answered for. It has no name: it is told
  // apart by its number, its questions and its methods.
  const COUNT_WORDS = ['One', 'Two', 'Three'];
  const OTHER = '__other__';

  function studyLabel(index) {
    return 'Study ' + (index + 1);
  }
  // How many studies the person said, from the radios' own shape. "More
  // than three" carries the number in the reveal; anything that is not a
  // whole number above three there is not an answer yet.
  function studyCount(choice) {
    const c = record(choice);
    const word = COUNT_WORDS.indexOf(text(c.v));
    if (word !== -1) return word + 1;
    if (text(c.v) === OTHER) {
      const n = Number(text(c.o));
      return Number.isInteger(n) && n > 3 ? n : 0;
    }
    return 0;
  }
  // The same answer, the other way round: what the radios should show for a
  // plan that already has this many studies.
  function studyCountChoice(count) {
    if (!Number.isInteger(count) || count < 1) return { v: '', o: '' };
    if (count <= 3) return { v: COUNT_WORDS[count - 1], o: '' };
    return { v: OTHER, o: String(count) };
  }

  // A study in the draft's shape: the questions it answers, by number, and
  // its four answers. Question numbers are kept whole, unique and in order,
  // and never point past the questions the plan has.
  function study(given, questionTotal) {
    const g = record(given);
    const wanted = new Set(list(g.questions).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && (questionTotal === undefined || n <= questionTotal)));
    return {
      questions: Array.from(wanted).sort((a, b) => a - b),
      methods: list(g.methods).slice(),
      characteristics: list(g.characteristics).slice(),
      userGroups: list(g.userGroups).slice(),
      sampleSize: g.sampleSize && typeof g.sampleSize === 'object' ? Object.assign({ v: '', o: '' }, g.sampleSize) : { v: '', o: '' },
    };
  }
  function studiesOf(draft) {
    const d = record(draft);
    const total = list(record(d.lists).researchQuestions).length;
    return list(d.studies).map((s) => study(s, total));
  }
  // One methods group per study. Before any study is declared there is
  // nothing to answer methods for, which is why Methodology waits (Gus's
  // decision 3, RPA-142).
  function groupCount(studies) {
    return list(studies).length;
  }
  function hasContent(s) {
    const st = study(s);
    return [st.methods, st.characteristics, st.userGroups].some((values) => values.some((v) => text(v)))
      || Boolean(text(st.sampleSize.v));
  }
  // Which studies answer a question; the first of them is where a suggestion
  // for that question goes.
  function studiesFor(studies, questionNumberWanted) {
    const out = [];
    list(studies).forEach((s, index) => { if (study(s).questions.indexOf(questionNumberWanted) !== -1) out.push(index); });
    return out;
  }
  // Every study must answer at least one question (decision 2): these are
  // the ones that do not.
  function emptyStudies(studies) {
    const out = [];
    list(studies).forEach((s, index) => { if (!study(s).questions.length) out.push(index); });
    return out;
  }
  // The written questions no study answers. Every research question must be
  // answered by at least one study, the mirror of every study answering at
  // least one question (Gus, 17 September 2026, RPA-140). A blank row is not
  // a question yet: Research judges that, and it needs no study until it
  // says something.
  function unassigned(questions, studies) {
    const covered = new Set();
    list(studies).forEach((s) => study(s).questions.forEach((n) => covered.add(n)));
    return answered(questions).map((q) => q.number).filter((n) => !covered.has(n));
  }
  // The unassigned questions worth saying out loud now. While a study still
  // answers nothing, the person is part-way through saying which questions
  // go where, and every question they have not reached would be "in no
  // study"; the empty study is the thing to fix first and says so itself.
  // Once every study answers something, a question in none of them has been
  // left over, and that is when the form speaks. Before any study is
  // declared there is nothing to reopen.
  function unclaimed(questions, studies) {
    if (!list(studies).length || emptyStudies(studies).length) return [];
    return unassigned(questions, studies);
  }
  // Removing question N: the studies drop it, and every question after it
  // moves up one, so the ticks keep pointing at the questions they meant.
  function withoutQuestion(studies, removedNumber) {
    return list(studies).map((s) => {
      const st = study(s);
      st.questions = st.questions.filter((n) => n !== removedNumber).map((n) => (n > removedNumber ? n - 1 : n));
      return st;
    });
  }
  // A plan saved before studies existed had one methods group per question.
  // Each group that said anything, or whose question exists, becomes a study
  // answering exactly that question; an untouched default group does not
  // become a study, because nobody declared one (RPA-142 migration).
  function studiesFromGroups(groups, questions) {
    const qs = numbered(questions);
    const out = [];
    list(groups).forEach((g, index) => {
      const asStudy = study(Object.assign({}, record(g), { questions: index < qs.length ? [index + 1] : [] }));
      if (hasContent(g) || (qs[index] && qs[index].text)) out.push(asStudy);
    });
    return out;
  }
  // The per-question view, for anything that still thinks in questions: the
  // submission wire format (RPA-64) is one methods group per question, so a
  // question's group is what the studies answering it say, in study order,
  // and its sample size is the first such study's.
  function perQuestionView(questions, studies) {
    const sts = list(studies).map((s) => study(s));
    const union = (key, covering) => {
      const seen = new Set();
      const out = [];
      covering.forEach((st) => st[key].forEach((v) => { const t = text(v); if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(v); } }));
      return out;
    };
    return numbered(questions).map((q) => {
      const covering = sts.filter((st) => st.questions.indexOf(q.number) !== -1);
      return {
        question: q.text,
        methods: union('methods', covering),
        characteristics: union('characteristics', covering),
        userGroups: union('userGroups', covering),
        sampleSize: covering.length ? Object.assign({}, covering[0].sampleSize) : { v: '', o: '' },
      };
    });
  }

  // The linked view: one item per study, carrying the questions it answers
  // (each with the outcome that answers it) and its four answers. A plan
  // with no studies reads as an empty list, which is also what it is.
  function link(parts) {
    const source = parts || {};
    const questions = numbered(source.questions);
    const outcomes = numbered(source.outcomes);
    return list(source.studies).map((s, index) => {
      const st = study(s, questions.length);
      return {
        number: index + 1,
        label: studyLabel(index),
        questions: st.questions.map((n) => ({
          number: n,
          label: questionNumber(n - 1),
          question: questions[n - 1] ? questions[n - 1].text : '',
          outcome: outcomes[n - 1] ? outcomes[n - 1].text : '',
        })),
        methods: st.methods,
        characteristics: st.characteristics,
        userGroups: st.userGroups,
        sampleSize: st.sampleSize,
      };
    });
  }
  // The same view, taken from a saved draft.
  function linksOf(draft) {
    const d = record(draft);
    const lists = record(d.lists);
    return link({ questions: lists.researchQuestions, outcomes: lists.outcomes, studies: d.studies });
  }

  return {
    numbered, answered, hasAnyQuestion, outcomeCount, questionNumber,
    COUNT_WORDS, studyLabel, studyCount, studyCountChoice, study, studiesOf, groupCount, hasContent,
    studiesFor, emptyStudies, unassigned, unclaimed, withoutQuestion, studiesFromGroups, perQuestionView,
    link, linksOf,
  };
});
