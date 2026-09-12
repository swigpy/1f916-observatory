import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeThread, derive, references, replyPartners, freshness, comparePulse } from '../src/model.mjs';
import { loadData } from '../scripts/data.mjs';
const ms=1_789_000_000_000;
const row=(id,author,extra={})=>({id,author,created_at:ms+id,body:'A public statement',...extra});
const thread=()=>({now:ms+10000,post:row(1,'alice',{title:'Test'}),comments:[row(12,'bob',{parent_id:null}),row(11,'carol',{parent_id:12}),row(13,'alice',{parent_id:null}),row(14,'dana',{parent_id:999})],comments_total:4,has_more:false});
test('normalization orders timestamp ties by id and retains the parent boundary',()=>{
  const raw=thread();raw.comments[0].created_at=ms+11;
  const t=normalizeThread(raw);assert.deepEqual(t.comments.map(c=>c.id),[11,12,13,14]);
  assert.equal(t.comments.find(c=>c.id===14).parent_id,999);
});
test('derived connections skip missing parents and self replies, and are scoped',()=>{
  const d=derive([normalizeThread(thread())],[]);
  assert.deepEqual(d.edges.map(e=>[e.from,e.to]),[['carol','bob'],['bob','alice']]);
  assert.deepEqual(replyPartners('bob',d.edges,[1]),[{handle:'alice',count:1},{handle:'carol',count:1}]);
  assert.deepEqual(replyPartners('bob',d.edges,[9]),[]);
});
test('duplicate rows and moderated source posts fail; moderated comments are excluded',()=>{
  let p=thread();p.comments.push(p.comments[0]);p.comments_total++;assert.throws(()=>normalizeThread(p),/Duplicate/);
  p=thread();p.post.mod_state='removed';assert.throws(()=>normalizeThread(p),/moderated/);
  p=thread();p.comments[0].mod_state='collapsed';assert.equal(normalizeThread(p).comments.length,3);
});
test('post reference extraction is explicit, unique and not a sentiment classifier',()=>{
  assert.deepEqual(references('Read #55, then (#3). Again #55. x#90 is not a reference. c90 is a comment.'),[3,55]);
});
test('frozen captures validate and every editorial source resolves inside its dossier',()=>{
  const {model,threads,editorial}=loadData();
  assert.equal(model.stories.length,3);assert.equal(model.posts.size,9);
  assert.equal(model.stories[0].comment_count,44);assert.equal(model.stories[0].participant_count,34);
  const bad=structuredClone(editorial.stories);bad[0].events[0].sources=['c999999'];assert.throws(()=>derive(threads,bad),/Missing/);
  bad[0].events[0].sources=['p4815'];assert.throws(()=>derive(threads,bad),/out-of-scope/);
});
test('freshness does not turn a future or old capture into live data',()=>{
  assert.equal(freshness(ms,ms+86_400_000).stale,true);assert.equal(freshness(ms,ms+3000).label,'Saved edition');
  assert.equal(freshness(ms+600000,ms).label,'Source clock is ahead');assert.equal(freshness(NaN,ms).stale,true);
});
test('activity distinguishes newer, unchanged, backwards and malformed markers',()=>{
  const b={latest_post_id:10,latest_comment_id:20,latest_event_id:30};
  assert.equal(comparePulse(b,b),'unchanged');assert.equal(comparePulse(b,{...b,latest_comment_id:21}),'newer');assert.equal(comparePulse(b,{...b,latest_post_id:9}),'uncertain');assert.throws(()=>comparePulse(b,{}));
});
