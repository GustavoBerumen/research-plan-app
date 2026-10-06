'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor, DRAFT_KEY } = require('./app-harness');
const keys = ['background', 'goal', 'problemStatement'];
const result = (name = 'Clarity', score = 3) => ({ metrics: [{name, score, desc: 'Explain ' + name}], recommendations: score === 3 ? [] : ['Clarify the decision.'] });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
const input = (app,key) => app.document.querySelector('[data-field="'+key+'"]');
const controls = (app,key) => input(app,key).closest('.field').querySelector('.eval-controls');
const action = (app,key) => {const c=controls(app,key); return c.querySelector(c.querySelector('.eval-result-summary').hidden ? '.eval-btn' : '.eval-actions > .eval-reevaluate-btn');};
const fill = (app,key,value) => setValue(app.window,input(app,key),value);
const finished = (app,key) => waitFor(() => !action(app,key).disabled);
const draft = () => ({version:7, fields:{emailAddress:'name@example.com'},lists:{},tables:{},ui:{section:'context'}});
async function boot(t, options={}) { const app=await bootApp({draft:draft(),...options});t.after(()=>app.close());return app; }

test('three independent Context actions preserve each field rubric and display assessment beside its answer', async t => {
  const app=await boot(t,{evaluate:body=>result(body.fieldKey,2)});
  assert.equal(app.document.querySelector('[data-evaluate-section="context"]'),null);
  for (const [index,key] of keys.entries()) {
    const c=controls(app,key), field=input(app,key).closest('.field');
    assert.equal(c.dataset.assessmentState,'not-assessed');
    assert.equal(action(app,key).textContent,'Assess this answer');
    assert.match(field.querySelector('.context-field-position').textContent,new RegExp((index+1)+' of 3'));
    fill(app,key,'Answer for '+key);
    action(app,key).focus();action(app,key).click();await finished(app,key);
    assert.equal(app.evaluationRequests.length,index+1);
    const body=app.evaluationRequests[index].body;
    assert.equal(body.fieldKey,key);assert.equal(body.text,'Answer for '+key);assert.ok(body.rubric.length>0);
    assert.equal(c.querySelector('.eval-panel').hidden,false);
    assert.equal(app.document.activeElement,c.querySelector('.eval-result-btn'));
    assert.equal(c.querySelector('.eval-badge').textContent,'Developing');
    assert.equal(c.querySelector('.eval-rec').textContent,'Clarify the decision.');
    assert.equal(input(app,key).value,'Answer for '+key);
    assert.equal(c.dataset.assessmentState,'assessed');
  }
  assert.deepEqual(app.jsdomErrors,[]);
});

test('blank assessment and navigation make no provider requests; advisory feedback never replaces required-answer validation', async t => {
  const app=await boot(t,{evaluate:()=>result('Clarity',1)});
  action(app,'background').click();
  assert.match(controls(app,'background').querySelector('.eval-error').textContent,/Add content/);
  assert.equal(app.evaluationRequests.length,0);
  fill(app,'background','Background written');
  const step=input(app,'background').closest('.step');
  step.querySelector('.step-continue').click();
  assert.equal(step.dataset.page,'1');assert.equal(app.evaluationRequests.length,0);
  step.querySelector('.step-continue').click();
  assert.equal(step.dataset.page,'1');
  assert.match(step.querySelector('.error-summary').textContent,/goal/i);
  assert.equal(app.evaluationRequests.length,0);
});

test('pending assessment is deduplicated and retains writing and focus; edits discard the obsolete result', async t => {
  const job=deferred();const app=await boot(t,{evaluate:()=>job.promise});
  fill(app,'background','Before');const button=action(app,'background');button.click();button.click();
  await waitFor(()=>app.evaluationRequests.length===1);
  assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-busy'),'true');
  assert.equal(controls(app,'background').dataset.assessmentState,'pending');
  input(app,'background').focus();fill(app,'background','After');
  job.resolve(result('Obsolete'));await finished(app,'background');
  const c=controls(app,'background');
  assert.equal(input(app,'background').value,'After');assert.equal(app.document.activeElement,input(app,'background'));
  assert.equal(c.dataset.assessmentState,'outdated');assert.equal(c.querySelector('.eval-result-summary').hidden,true);
  assert.doesNotMatch(c.textContent,/Obsolete/);
  await waitFor(()=>JSON.parse(app.window.localStorage.getItem(DRAFT_KEY)).fields.background==='After');
});

test('editing during a replacement retains the previous assessment as stale and rejects late success and late errors', async t => {
  for (const fail of [false,true]) {
    const job=deferred();let calls=0;const app=await boot(t,{evaluate:()=>++calls===1?result('Kept'):job.promise});
    fill(app,'background','Original');action(app,'background').click();await finished(app,'background');
    const c=controls(app,'background');
    fill(app,'background','At request');assert.equal(c.querySelector('.eval-stale-status').hidden,false);
    action(app,'background').click();await waitFor(()=>calls===2);fill(app,'background','Newer writing');
    fail?job.reject(new Error('Obsolete failure')):job.resolve(result('Obsolete'));
    await finished(app,'background');
    assert.equal(c.querySelector('.eval-mname').textContent,'Kept');assert.equal(c.dataset.assessmentState,'outdated');
    assert.equal(c.querySelector('.eval-save-btn').disabled,true);assert.equal(c.querySelector('.eval-error').hidden,true);
  }
});

test('failure retains draft and gives a focused manual retry; failed replacement keeps existing assessment', async t => {
  let fail=true;const app=await boot(t,{evaluate:()=>{if(fail)throw new Error('Offline fixture');return result('Retained');}});
  fill(app,'goal','Keep this goal');action(app,'goal').click();await finished(app,'goal');
  const c=controls(app,'goal');assert.equal(c.dataset.assessmentState,'unavailable');
  assert.match(c.querySelector('.eval-error').textContent,/Offline fixture/);assert.equal(input(app,'goal').value,'Keep this goal');
  fail=false;c.querySelector('.eval-btn').focus();c.querySelector('.eval-btn').click();await finished(app,'goal');
  assert.equal(app.evaluationRequests.length,2);assert.equal(c.querySelector('.eval-panel').hidden,false);
  fail=true;action(app,'goal').click();await finished(app,'goal');
  assert.equal(c.querySelector('.eval-mname').textContent,'Retained');assert.equal(c.querySelector('.eval-save-btn').disabled,false);
  assert.equal(c.dataset.assessmentState,'unavailable');
  await waitFor(()=>JSON.parse(app.window.localStorage.getItem(DRAFT_KEY)).fields.goal==='Keep this goal');
});

test('Context and Research share the two-request limit; an edited queued Context answer is not silently assessed', async t => {
  const jobs=[];const app=await boot(t,{evaluate:body=>{const j=deferred();jobs.push({...j,body});return j.promise;}});
  keys.forEach(key=>fill(app,key,key));fill(app,'objective','Objective');
  keys.forEach(key=>action(app,key).click());
  app.document.querySelector('[data-evaluate-section="research"]').click();
  await waitFor(()=>jobs.length===2);
  assert.equal(jobs.length,2);assert.match(controls(app,'problemStatement').querySelector('.field-eval-progress').textContent,/queued/);
  fill(app,'problemStatement','Changed before dispatch');jobs[0].resolve(result());
  await waitFor(()=>jobs.length===3);assert.equal(jobs[2].body.fieldKey,'objective');
  assert.equal(controls(app,'problemStatement').dataset.assessmentState,'outdated');
  jobs[1].resolve(result());jobs[2].resolve(result());await finished(app,'goal');
  assert.equal(app.evaluationRequests.some(r=>r.body.fieldKey==='problemStatement'),false);
});

test('weak feedback can continue and mark this answer to revisit without starting another request', async t => {
  const app=await boot(t,{evaluate:()=>result('Clarity',1)});
  fill(app,'background','Background');action(app,'background').click();await finished(app,'background');
  const c=controls(app,'background'),step=input(app,'background').closest('.step');
  assert.equal(c.querySelector('.context-return-later').hidden,false);
  c.querySelector('.context-return-later').click();assert.equal(step.dataset.page,'1');assert.equal(app.evaluationRequests.length,1);
  // Back is the established within-section route.
  step.querySelector('.step-back').click();assert.equal(step.dataset.page,'0');
  assert.equal(c.querySelector('.context-review-reminder').hidden,false);
  assert.match(c.querySelector('.context-review-reminder').textContent,/Background.*this session/);
  c.querySelector('.context-clear-reminder').click();assert.equal(c.querySelector('.context-review-reminder').hidden,true);
  assert.equal(app.document.activeElement,c.querySelector('.context-return-later'));
});

test('a fresh Ready assessment clears the session reminder; writing survives reload while feedback does not', async t => {
  let score=1;const app=await boot(t,{evaluate:()=>result('Clarity',score)});
  fill(app,'background','Persisted answer');action(app,'background').click();await finished(app,'background');
  const c=controls(app,'background');c.querySelector('.context-return-later').click();
  const saved=JSON.parse(app.window.localStorage.getItem(DRAFT_KEY));
  const reloaded=await boot(t,{draft:saved,evaluate:()=>result()});
  assert.equal(input(reloaded,'background').value,'Persisted answer');assert.equal(controls(reloaded,'background').dataset.assessmentState,'not-assessed');
  assert.equal(controls(reloaded,'background').querySelector('.context-review-reminder').hidden,true);
  score=3;action(app,'background').click();await finished(app,'background');
  assert.equal(c.querySelector('.context-review-reminder').hidden,true);assert.equal(c.querySelector('.context-return-later').hidden,true);
});

for (const reset of ['clear','profile']) test(reset+' cancels active and queued assessments and rejects late responses',async t=>{
  const jobs=[];const app=await boot(t,{url:'https://research-plan.test/?test',evaluate:()=>{const j=deferred();jobs.push(j);return j.promise;}});
  keys.forEach(key=>fill(app,key,key));keys.forEach(key=>action(app,key).click());await waitFor(()=>jobs.length===2);
  if(reset==='clear')app.document.getElementById('clear-btn').click();else app.window.applyTestProfile('experienced');
  assert.ok(app.evaluationRequests.every(r=>r.signal.aborted));
  jobs[0].resolve(result('Obsolete'));jobs[1].reject(new Error('Obsolete error'));
  await new Promise(r=>setTimeout(r,20));
  keys.forEach(key=>{const c=controls(app,key);assert.equal(c.dataset.assessmentState,'not-assessed');assert.equal(c.querySelector('.eval-result-summary').hidden,true);assert.equal(c.querySelector('.eval-error').hidden,true);assert.equal(action(app,key).disabled,false);});
  assert.equal(jobs.length,2);
  fill(app,'background','Fresh');action(app,'background').click();await waitFor(()=>jobs.length===3);jobs[2].resolve(result('Fresh'));
  await finished(app,'background');assert.equal(controls(app,'background').querySelector('.eval-mname').textContent,'Fresh');
});

test('Context assessment never enables restricted calibration or triggers requests during print',async t=>{
  const app=await boot(t,{configResponse:()=>({ok:true,json:async()=>({pilotMode:true,capabilities:{calibration:false}})}),evaluate:()=>result()});
  fill(app,'background','Writing');action(app,'background').click();await finished(app,'background');
  const c=controls(app,'background');for(const kind of ['save','like','dislike'])assert.equal(c.querySelector('.eval-'+kind+'-btn').disabled,true);
  app.document.getElementById('print-btn').click();app.window.dispatchEvent(new app.window.Event('beforeprint'));app.window.dispatchEvent(new app.window.Event('afterprint'));
  assert.equal(c.querySelector('.eval-panel').hidden,false);assert.equal(app.evaluationRequests.length,1);
});

test('a weak criterion keeps return-later available even when the existing overall classification is Good',async t=>{
 const app=await boot(t,{evaluate:()=>({metrics:[{name:'Contextual Relevance',score:1,desc:'Needs a decision.'},{name:'Essential Knowledge',score:3,desc:'Clear terms.'},{name:'Focus',score:3,desc:'Concise.'}],recommendations:['Name the decision.']})});
 fill(app,'background','Background');action(app,'background').click();await finished(app,'background');
 const c=controls(app,'background');assert.equal(c.querySelector('.eval-badge').textContent,'Good');
 assert.equal(c.querySelector('.context-return-later').hidden,false);
});

test('reassessment restores keyboard focus to its action, and failure focuses the explicit retry',async t=>{
 let fail=false;const app=await boot(t,{evaluate:()=>{if(fail)throw new Error('Offline');return result();}});
 fill(app,'background','Answer');action(app,'background').focus();action(app,'background').click();await finished(app,'background');
 const c=controls(app,'background'),again=c.querySelector('.eval-actions > .eval-reevaluate-btn');
 again.focus();again.click();await finished(app,'background');assert.equal(app.document.activeElement,again);
 fail=true;again.focus();again.click();await finished(app,'background');assert.equal(app.document.activeElement,c.querySelector('.eval-btn'));
});
