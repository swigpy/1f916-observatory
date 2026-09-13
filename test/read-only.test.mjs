import test from 'node:test';
import assert from 'node:assert/strict';
import { readPublic, sourceUrl } from '../src/read-api.mjs';
import { auditSource, auditMarkup } from '../scripts/audit.mjs';

test('the network boundary sends only public GETs without credentials or redirects',async t=>{
  const requests=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{requests.push({url,options});return new Response('{"board":{}}',{headers:{'content-type':'application/json'}});});
  for(const [kind,key] of [['pulse'],['post',4750],['comment',54606],['citizen','gnomon'],['grant','1f512']])await readPublic(kind,key);
  assert.equal(requests.length,5);
  for(const {url,options} of requests){assert.equal(new URL(url).origin,'https://1f916.ai');assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.body,undefined);assert.deepEqual(options.headers,{Accept:'application/json'});assert.equal(options.referrerPolicy,'no-referrer');}
});
test('auth, writes, arbitrary URLs, traversal and malformed selectors fail before network',async t=>{
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('should not be called');});
  for(const [kind,key] of [['me'],['vote',1],['register'],['__proto__'],['constructor'],['post','1?review=1'],['post',0],['post',-1],['post',NaN],['post',1.5],['citizen','../me'],['citizen','a?secret=x'],['citizen','https://evil.example'],['grant','a/b'],['https://1f916.ai/api/post',1]])await assert.rejects(()=>readPublic(kind,key));
  assert.equal(calls,0);
  assert.equal(sourceUrl('post',1),'https://1f916.ai/api/post/1');
});
test('HTTP errors, redirects, malformed JSON, HTML and oversized sources are rejected',async t=>{
  for(const [body,init] of [['gone',{status:404}],['slow',{status:429}],['bad',{status:503}],['{',{headers:{'content-type':'application/json'}}],['<html>',{headers:{'content-type':'text/html'}}],['{}',{headers:{'content-type':'application/json','content-length':'8000001'}}]]){
    const mock=t.mock.method(globalThis,'fetch',async()=>new Response(body,init));await assert.rejects(()=>readPublic('pulse'));mock.mock.restore();
  }
  t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('Redirect disallowed');});await assert.rejects(()=>readPublic('pulse'),/Redirect/);
});
test('streaming byte limit is enforced when Content-Length is absent',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array(8_000_001),{headers:{'content-type':'application/json'}}));
  await assert.rejects(()=>readPublic('pulse'),/too large/);
});
test('the request deadline aborts an unresponsive read',async t=>{
  t.mock.method(globalThis,'setTimeout',callback=>{queueMicrotask(callback);return 1;});
  t.mock.method(globalThis,'clearTimeout',()=>{});
  let signal;
  t.mock.method(globalThis,'fetch',async(_url,options)=>{signal=options.signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('Aborted')),{once:true}));});
  await assert.rejects(()=>readPublic('pulse'),/Aborted/);assert.equal(signal.aborted,true);
});
test('static audit fails for negative controls, including a changed HTTP method',()=>{
  assert.ok(auditSource("fetch(url,{method:'POST',credentials:'omit',redirect:'error'})",'src/read-api.mjs').length);
  assert.ok(auditSource("fetch(url,{method:'GET'})",'src/app.mjs').length);
  for(const code of ["node.innerHTML=text", "node['outerHTML']=text",'new WebSocket(url)','navigator.sendBeacon(url)','eval(text)'])assert.ok(auditSource(code,'src/app.mjs').length);
  assert.ok(auditMarkup('<html><body><input><script>alert(1)</script></body></html>').length);
});
