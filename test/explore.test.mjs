import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';
import { selectPosts,periodStart,hotScore,indexPost,topicMatches,indexPages } from '../src/explore.mjs';
import { exploreView } from '../src/explore-render.mjs';
import { collectIndex } from '../scripts/capture-index.mjs';
import { sourceUrl,readPublic } from '../src/read-api.mjs';
import { shell } from '../src/render.mjs';
import { loadData } from '../scripts/data.mjs';
import { auditMarkup } from '../scripts/audit.mjs';
import { enhance } from '../src/app.mjs';
const asOf=Date.parse('2026-09-12T14:00:00Z');
const row=(id,days=0,votes=0,comments=0)=>({id,title:`Post ${id}`,body:'A public post.',author:'gnomon',created_at:asOf-days*86400000,votes,weighted_votes:votes,comments,body_truncated:false});
test('topic picker stays reachable when changing from a narrow to a wide screen',()=>{
  const dom=new JSDOM('<details data-topic-picker open><summary>Choose a topic</summary><a href="/explore/">All topics</a></details>');
  let changed;const media={matches:true,addEventListener:(event,fn)=>{assert.equal(event,'change');changed=fn;}};
  dom.window.matchMedia=()=>media;
  enhance(dom.window.document,()=>{throw new Error('Navigation must not make API requests');});
  assert.equal(dom.window.document.querySelector('details').open,false);
  media.matches=false;changed();assert.equal(dom.window.document.querySelector('details').open,true);dom.window.close();
});
test('Top keeps old valuable posts while Hot decays by age; ties are deterministic',()=>{
  const old=row(1,35,100),recent=row(2,0,2),busy=row(3,1,1,90);const posts=[old,recent,busy];
  assert.equal(selectPosts(posts,{sort:'top',period:'all',asOf})[0].id,1);
  assert.equal(selectPosts(posts,{sort:'hot',period:'all',asOf})[0].id,2);
  assert.equal(selectPosts(posts,{sort:'comments',period:'all',asOf})[0].id,3);
  assert.equal(selectPosts(posts,{sort:'newest',period:'all',asOf})[0].id,2);
  assert.ok(hotScore(old,asOf)<hotScore(recent,asOf));
  assert.deepEqual(selectPosts([row(5),row(4)],{sort:'top',period:'all',asOf}).map(p=>p.id),[5,4]);
  assert.equal(posts[0],old);
});
test('UTC calendar periods include exact lower boundary and exclude future rows',()=>{
  for(const [period,date] of [['today','2026-09-12'],['week','2026-09-07'],['month','2026-09-01'],['year','2026-01-01']]){
    const start=Date.parse(date+'T00:00:00Z');assert.equal(periodStart(period,asOf),start);
    const posts=[{...row(1),created_at:start},{...row(2),created_at:start-1},{...row(3),created_at:asOf+1}];
    assert.deepEqual(selectPosts(posts,{period,asOf}).map(p=>p.id),[1]);
  }
  assert.equal(periodStart('week',Date.parse('2026-01-01T14:00Z')),Date.parse('2025-12-29T00:00Z'));
  assert.throws(()=>selectPosts([],{sort:'__proto__',asOf}));assert.throws(()=>selectPosts([],{topic:'constructor',asOf}));
});
test('topics are multi-label keyword clues, with explicit unclassified fallback',()=>{
  const p={...row(1),title:'Building a game',body:'A proposal for a poem.'};
  assert.deepEqual(topicMatches(p).map(m=>m.topic),['building','governance','culture']);
  assert.equal(topicMatches(row(2))[0].topic,'unclassified');
  assert.equal(selectPosts([p,row(2)],{topic:'culture',period:'all',sort:'top',asOf}).length,1);
  assert.equal(topicMatches({...row(3),body:'I run a model.'})[0].topic,'unclassified');
});
test('pagination covers every result once, including empty and last pages',()=>{
  const posts=Array.from({length:53},(_,i)=>row(i+1));const pages=indexPages(posts,{period:'all',asOf});
  assert.deepEqual(pages.map(p=>p.length),[25,25,3]);assert.equal(new Set(pages.flat().map(p=>p.id)).size,53);
  assert.deepEqual(indexPages([],{period:'all',asOf}),[[]]);assert.equal(indexPost({...row(1),body:null}).body,'');
  assert.throws(()=>indexPost({...row(1),votes:-1}));
});
test('whole-board walk carries snapshot and pin cursors, deduplicates pins and refuses gaps',async()=>{
  const first={snapshot_id:20,pin_snapshot:'1',board_total:3,now:asOf,posts:[row(1),row(3)],has_more:true,next_before:`${asOf}:3`};
  const last={...first,posts:[row(1),row(2)],has_more:false,next_before:null};
  const make=d=>({url:sourceUrl('newest'),data:d,bytes:Buffer.from(JSON.stringify(d))});
  let i=0;const calls=[];const result=await collectIndex(async(k,key)=>{calls.push([k,key]);return make(i++?last:first);});
  assert.equal(result.posts.length,3);assert.equal(result.complete_walk,true);
  assert.deepEqual(calls[1],['newest',{before:`${asOf}:3`,snapshot_id:20,pin_snapshot:'1'}]);
  i=0;await assert.rejects(()=>collectIndex(async()=>make(i++?{...last,snapshot_id:21}:first)),/membership/);
  i=0;await assert.rejects(()=>collectIndex(async()=>make(i++?{...last,posts:[row(3)]}:first)),/Duplicate/);
  await assert.rejects(()=>collectIndex(async()=>make({...first,posts:[]})),/Non-advancing/);
});
test('feed request selectors cannot add arbitrary parameters or switch to writes',async t=>{
  let calls=0;t.mock.method(globalThis,'fetch',async(_url,options)=>{calls++;assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');return new Response('{}',{headers:{'content-type':'application/json'}});});
  await readPublic('newest');await readPublic('newest',{before:`${asOf}:3`,snapshot_id:20,pin_snapshot:'1,2'});assert.equal(calls,2);
  for(const key of [{url:'https://example.com'},{before:'1:2&secret=x',snapshot_id:1,pin_snapshot:''},{before:'1:2',snapshot_id:1,pin_snapshot:'../me'},{before:'1:2'},{limit:200},null])await assert.rejects(()=>readPublic('newest',key));
  assert.equal(calls,2);
});
test('exploration is pre-rendered, accessible, escapes untrusted text and preserves filter dimensions',async()=>{
  const d=loadData();const rows=[{...row(1,1,25,7),title:'<img src=x onerror=alert(1)>',body:'</p><script>alert(1)</script>'}];
  const index={posts:rows,manifest:{as_of:asOf,capture_started_at:asOf,capture_finished_at:asOf,board_total:1}};
  const body=exploreView({index,rows,total:26,pages:2,page:1,topic:'building',sort:'top',period:'month',base:'../../../../../',model:d.model,profiles:d.profiles});
  const html=shell({title:'Explore',description:'Explore',body,base:'../../../../../',active:'explore',manifest:d.manifest,pulse:d.pulse});
  assert.deepEqual(auditMarkup(html),[]);const dom=new JSDOM(html,{runScripts:'outside-only'}),doc=dom.window.document;
  assert.equal(doc.querySelectorAll('img,script:not([src]),input,textarea').length,0);assert.match(doc.querySelector('.post-summary h3').textContent,/<img/);
  assert.ok(doc.querySelector('a[href="../../../../../explore/building/comments/month/1/"]'));
  assert.ok(doc.querySelector('a[href="../../../../../explore/building/top/year/1/"]'));
  assert.ok(doc.querySelector('a[href="../../../../../explore/culture/top/month/1/"]'));
  assert.ok(doc.querySelector('a[href="../../../../../explore/building/top/month/2/"]'));
  dom.window.eval(axe.source);const result=await dom.window.axe.run(doc,{rules:{'color-contrast':{enabled:false}}});assert.equal(result.violations.length,0,JSON.stringify(result.violations.map(v=>v.id)));dom.window.close();
});
