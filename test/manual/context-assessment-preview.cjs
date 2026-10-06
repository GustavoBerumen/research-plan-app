'use strict';
// Loopback mock only: no .env, provider SDK, submissions or calibration writes.
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'../..');const evidence=path.join(__dirname,'context-assessment-evidence');
const assets=new Set(['index.html','favicon.svg','style.css','app.js','plan-model.js','plan-document.js','plan-workflow.js','score-classification.js','textarea-autosize.js','submission-contract.js','submission-ui.js','test-profiles.js','research-plan-template.md','research-plan-rubric.md','research-methods.md']);
const types={'.html':'text/html','.svg':'image/svg+xml','.css':'text/css','.js':'text/javascript','.md':'text/plain'};
let requests=0;
const seed={version:7,fields:{emailAddress:'preview@example.com',background:'We are testing a research planning tool with researchers and colleagues who plan research occasionally. We want to understand where the first version helps them and where its guidance is unclear.',goal:'Help product teams agree on a research plan before collecting evidence.',problemStatement:'Colleagues struggle to connect research questions to the decisions their teams need to make.'},lists:{},tables:{},ui:{section:'context'}};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');const json=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 if(url.pathname==='/healthz')return res.end('ok');
 if(url.pathname==='/preview-status')return json({mockedRequests:requests,providerCalls:0});
 if(url.pathname==='/capture'&&req.method==='GET'){res.setHeader('Content-Type','text/html');return res.end('<title>Local screenshot saver</title><form method="post" action="/capture"><label>Screenshot name<input name="name"></label><label>Captured JPEG base64<textarea name="data"></textarea></label><button>Save local screenshot</button></form>');}
 if(url.pathname==='/capture'&&req.method==='POST'){
  if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:'+server.address().port)return json({error:'Loopback only'},403);
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>6000000)return json({error:'Too large'},413);}
  const values=new URLSearchParams(raw);const name=values.get('name')||'';const data=Buffer.from(values.get('data')||'','base64');
  if(!/^[a-z0-9-]{1,80}\.jpg$/.test(name)||data.length<100||data.length>3000000||data[0]!==255||data[1]!==216)return json({error:'Expected named JPEG'},400);
  fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,name),data);res.setHeader('Content-Type','text/html');return res.end('<h1>Screenshot saved</h1><p>'+name+'</p>');
 }
 if(url.pathname==='/api/config')return json({pilotMode:true,jiraEnabled:false,build:'LOCAL MOCK',capabilities:{calibration:false,uploads:false,addFramework:false,jira:false,googleDrive:false,feedback:false}});
 if(url.pathname==='/api/evaluate'&&req.method==='POST'){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536)return json({error:'Too large'},413);}
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
  requests++;await new Promise(r=>setTimeout(r,body.text.includes('[slow]')?3000:450));
  if(body.text.includes('[fail]'))return json({error:'Simulated offline assessment. Remove [fail] and retry.'},503);
  const ready=body.text.includes('[ready]');return json({metrics:body.rubric.map((c,i)=>({name:c.name,score:ready||i?3:1,desc:'Mock feedback: '+(i?'The answer gives useful detail for this criterion.':'Clarify who needs the research and which decision it will inform.')})),recommendations:ready?[]:['Name the decision this research will support. Keep claims within the evidence you have.']});
 }
 if(req.method!=='GET')return json({error:'Preview does not collect data'},403);
 const asset=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!assets.has(asset)){res.writeHead(404);return res.end('Not available');}
 let data=fs.readFileSync(path.join(root,asset));
 if(asset==='index.html')data=Buffer.from(data.toString().replace(/<link[^>]*href="https:[^"]*"[^>]*>/g,'').replace('<script src="test-profiles.js">','<script>if(!localStorage.getItem("research-plan-app:draft"))localStorage.setItem("research-plan-app:draft",'+JSON.stringify(JSON.stringify(seed))+');</script><script src="test-profiles.js">'));
 res.writeHead(200,{'Content-Type':(types[path.extname(asset)]||'text/plain')+'; charset=utf-8','Cache-Control':'no-store'});res.end(data);
});
server.listen(8966,'127.0.0.1',()=>console.log('Context A mock preview: http://127.0.0.1:8966/'));
