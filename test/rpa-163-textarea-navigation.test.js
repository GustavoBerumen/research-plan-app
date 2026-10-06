'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {bootApp,setValue}=require('./app-harness');
const long='A long background answer with retained evidence and terminology. '.repeat(10);
const draft={version:7,fields:{emailAddress:'name@example.com',background:long,goal:'A goal',problemStatement:'A problem'},lists:{},tables:{},ui:{section:'context'}};
function measuredHeight(textarea,height){
 if(textarea.closest('[hidden], .page-hidden'))return 0;
 if(textarea.closest('.acc-body')&&textarea.closest('.step-checking'))return 0;
 return textarea.value.length>120?height:40;
}
async function setup(t){let height=220;const app=await bootApp({draft,textareaScrollHeight:ta=>measuredHeight(ta,height)});t.after(()=>app.close());
 const background=app.document.querySelector('[data-field="background"]'),step=background.closest('.step');
 return {...app,background,step,setHeight:h=>{height=h;}};
}
function checkHeight(input,expected){
 const styles=input.ownerDocument.defaultView.getComputedStyle(input);
 const borders=(parseFloat(styles.borderTopWidth)||0)+(parseFloat(styles.borderBottomWidth)||0);
 assert.equal(parseFloat(input.style.height),expected+borders);
}
test('restored Context answer is measured when its initial page is revealed',async t=>{
 const app=await setup(t);checkHeight(app.background,220);assert.equal(app.background.value,long);
});
test('check-page return retains the hidden height and remeasures the revealed answer without editing',async t=>{
 const app=await setup(t);const next=app.step.querySelector('.step-continue');next.click();next.click();next.click();
 assert.equal(app.step.classList.contains('step-checking'),true);
 app.setHeight(310);app.window.dispatchEvent(new app.window.Event('resize'));
 checkHeight(app.background,220);assert.equal(app.background.value,long);
 const change=[...app.step.querySelectorAll('.summary-change')].find(b=>b.textContent.includes('Background'));
 assert.ok(change,'Check answers has a Background Change action');change.click();
 checkHeight(app.background,310);assert.equal(app.background.value,long);assert.equal(app.evaluationRequests.length,0);
});
test('ordinary Back measures a returning answer at the changed width, and deletion can still shrink it',async t=>{
 const app=await setup(t);app.step.querySelector('.step-continue').click();
 app.setHeight(340);app.window.dispatchEvent(new app.window.Event('resize'));checkHeight(app.background,220);
 app.step.querySelector('.step-back').click();checkHeight(app.background,340);
 setValue(app.window,app.background,'Short answer');checkHeight(app.background,40);assert.equal(app.evaluationRequests.length,0);
});
