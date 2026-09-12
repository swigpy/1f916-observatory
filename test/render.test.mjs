import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';
import { loadData } from '../scripts/data.mjs';
import { shell, home, dossier, citizen, method } from '../src/render.mjs';
import { enhance } from '../src/app.mjs';
import { zip } from '../scripts/zip.mjs';
import { auditMarkup } from '../scripts/audit.mjs';
const d=loadData();
const wrap=body=>shell({title:'Observatory',description:'Read-only stories',body,base:'./',manifest:d.manifest,pulse:d.pulse});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('untrusted titles, quotations and editorial text are inert text in real parsed markup',()=>{
  const story=structuredClone(d.model.stories[0]);story.title='<img src=x onerror="window.pwned=1">';story.deck='</p><script>window.pwned=1</script>';
  const sources=new Map(d.model.sources);sources.set('p4750',{...sources.get('p4750'),title:'</summary><svg onload="window.pwned=1">',body:'</blockquote><script>window.pwned=1</script>'});
  const dom=new JSDOM(wrap(dossier(story,{...d.model,sources},d.manifest)),{runScripts:'dangerously'});
  assert.equal(dom.window.pwned,undefined);assert.equal(dom.window.document.querySelectorAll('img,svg,script:not([src]),[onerror],[onload]').length,0);
  assert.match(dom.window.document.querySelector('h1').textContent,/<img/);
  assert.match(dom.window.document.querySelector('#source-p4750').textContent,/<script>/);
});
test('all static journeys have headings, provenance, safe controls and accessible names',async()=>{
  const bodies=[home(d.model,d.manifest),...d.model.stories.map(s=>dossier(s,d.model,d.manifest)),citizen(d.profiles.find(p=>p.handle==='gnomon'),d.model,d.manifest,d.profiles),method(d.manifest,d.model)];
  for(const body of bodies){
    const html=wrap(body);assert.deepEqual(auditMarkup(html),[]);
    const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://observatory.example/'});dom.window.eval(axe.source);
    const result=await dom.window.axe.run(dom.window.document,{rules:{'color-contrast':{enabled:false}}});
    assert.equal(result.violations.length,0,JSON.stringify(result.violations.map(v=>({id:v.id,impact:v.impact}))));dom.window.close();
  }
});
test('without JavaScript, stories, dossier content and primary links are already present',()=>{
  const doc=new JSDOM(wrap(dossier(d.model.stories[0],d.model,d.manifest))).window.document;
  assert.equal(doc.querySelectorAll('.timeline>li').length,5);assert.ok(doc.querySelectorAll('a[href^="https://1f916.ai/api/"]').length>=5);
  assert.equal(doc.querySelector('[data-check-activity]').hidden,true);assert.equal(doc.querySelectorAll('input,form,textarea').length,0);
});
test('offline or malformed live responses preserve the entire saved story and reenable the check',async()=>{
  for(const get of [async()=>{throw new TypeError('offline');},async()=>({data:{board:{}}})]){
    const dom=new JSDOM(wrap(dossier(d.model.stories[0],d.model,d.manifest)),{url:'https://observatory.example/'});const doc=dom.window.document;
    const before=doc.querySelector('.story-body').textContent;enhance(doc,get,()=>d.manifest.first_read_at);
    doc.querySelector('[data-check-activity]').click();await tick();
    assert.match(doc.querySelector('[role="status"]').textContent,/unavailable/);assert.equal(doc.querySelector('.story-body').textContent,before);assert.equal(doc.querySelector('button').disabled,false);
  }
});
test('live checks are opt-in, single flight and limited to one attempt a minute',async()=>{
  const dom=new JSDOM(wrap(home(d.model,d.manifest)));let calls=0;let release;
  const get=()=>{calls++;return new Promise(resolve=>release=resolve);};enhance(dom.window.document,get,()=>d.manifest.first_read_at);
  assert.equal(calls,0);const button=dom.window.document.querySelector('button');button.click();button.click();assert.equal(calls,1);
  release({data:{board:{...d.pulse,latest_post_id:d.pulse.latest_post_id+1}}});await tick();
  assert.match(dom.window.document.querySelector('[role="status"]').textContent,/newer activity/);button.click();await tick();assert.equal(calls,1);assert.match(dom.window.document.querySelector('[role="status"]').textContent,/one minute/);
});
test('a source citation opens the exact source disclosure',()=>{
  const dom=new JSDOM(wrap(dossier(d.model.stories[0],d.model,d.manifest)),{url:'https://observatory.example/'});
  const doc=dom.window.document;enhance(doc,async()=>{throw new Error('No network expected');});
  doc.querySelector('a[href="#source-c54606"]').click();assert.equal(doc.querySelector('#source-c54606').open,true);
});
test('source ZIP is deterministic and uses safe relative UTF-8 paths',()=>{
  const files=[['src/a.mjs','const a=1;'],['README.md','Read me']];const a=zip(files),b=zip([...files].reverse());assert.deepEqual(a,b);assert.equal(a.readUInt32LE(0),0x04034b50);assert.ok(a.includes(Buffer.from('src/a.mjs')));
});
