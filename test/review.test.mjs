import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { displayText, escapeHtml, excerpt } from '../src/model.mjs';
import { exploreStats, selectPosts } from '../src/explore.mjs';
import { exploreView } from '../src/explore-render.mjs';
import { external, home, citizen, shell } from '../src/render.mjs';
import { loadIndex } from '../scripts/index-data.mjs';
import { loadData } from '../scripts/data.mjs';
import { auditMarkup } from '../scripts/audit.mjs';
import { collectIndex, pageBudget } from '../scripts/capture-index.mjs';

const index=loadIndex(),data=loadData(),asOf=index.manifest.as_of;
const forbidden=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;
const view=(rows,options={})=>exploreView({index,rows,total:rows.length,pages:1,base:'../',model:data.model,profiles:data.profiles,...options});
test('display controls are removed without changing source text, newlines, emoji or RTL letters',()=>{
  const original='A\0B\u0008\u202eC\u2066D\u2069\u007f\u0085\r\n\t🔒 مرحبا <script>';
  assert.equal(displayText(original),'ABCD\n\t🔒 مرحبا <script>');
  assert.equal(escapeHtml(original),'ABCD\n\t🔒 مرحبا &lt;script&gt;');
  assert.ok(original.includes('\0'));assert.equal(excerpt('o\0ne t\u202ewo'),'one two');
});
test('real post 2565 renders without NULs while all raw/projected source fields still verify',()=>{
  const p=index.posts.find(p=>p.id===2565),before=JSON.stringify(p);
  assert.equal(p.body.split('\0').length-1,117);
  const html=view([p]);assert.equal(forbidden.test(html),false);assert.equal(JSON.stringify(p),before);
  const doc=new JSDOM(html).window.document;
  assert.equal(doc.querySelector('blockquote').textContent,displayText(p.body));
  assert.ok(auditMarkup(shell({title:'Test\0',description:'x',body:'<h1>x</h1>\u202e',base:'../',manifest:data.manifest,pulse:data.pulse})).some(x=>x.includes('control')));
  assert.equal(loadIndex().posts.find(p=>p.id===2565).body,p.body);
});
test('real index counts expose the classification gaps and period coverage',()=>{
  const stats=exploreStats(index.posts,asOf);
  assert.deepEqual(stats.byPeriod.all,{all:4985,building:1351,governance:470,economy:523,culture:180,research:682,identity:1014,unclassified:1944});
  assert.equal(stats.truncated,4779);assert.deepEqual(stats.byPeriod.year,stats.byPeriod.all);
  const first=period=>selectPosts(index.posts,{sort:'hot',period,asOf}).slice(0,25).map(p=>p.id);
  assert.deepEqual(first('today'),first('all'));
  const html=view(index.posts.slice(0,1));assert.match(html,/first page unchanged/);assert.match(html,/currently contain the same posts/);
});
test('titles keep the first reading action local and expose the external reader by hostname',()=>{
  const p=index.posts.find(p=>p.id===2565),doc=new JSDOM(view([p])).window.document;
  assert.equal(doc.querySelector('h3 a'),null);assert.equal(doc.querySelector('.captured-preview summary h3').textContent,displayText(p.title));
  const reader=[...doc.querySelectorAll('a')].filter(a=>a.href.startsWith('https://sirpixelalittle.github.io'));
  assert.equal(reader.length,1);assert.match(reader[0].textContent,/sirpixelalittle.github.io/);
  const selected=index.posts.find(p=>data.model.stories.some(s=>s.posts.includes(p.id)));
  assert.match(new JSDOM(view([selected])).window.document.querySelector('h3 a').getAttribute('href'),/^\.\.\/stories\//);
  assert.throws(()=>external('https://sirpixelalittle.github.io/other-project/post/1','Reader'));
  assert.throws(()=>external('https://sirpixelalittle.github.io/1f916-reader/post/1?next=elsewhere','Reader'));
});
test('empty selections offer an actual escape and controls expose useful counts',()=>{
  const doc=new JSDOM(view([],{topic:'culture',period:'today'})).window.document;
  assert.equal(doc.querySelector('.explore-empty').textContent.includes('Keep this selection'),false);
  assert.ok(doc.querySelector('.explore-empty a[href="../explore/all/hot/all/1/"]'));
  assert.ok(doc.querySelector('[aria-label="Culture & play: 3 posts"]'));
});
test('profile and source-download provenance limits are visible in the page markup',()=>{
  assert.match(home(data.model,data.manifest),/public forum where AI programs have accounts called citizens/);
  assert.match(citizen(data.profiles[0],data.model,data.manifest,data.profiles),/full response was not retained/);
  assert.match(shell({title:'x',description:'x',body:'<h1>x</h1>',base:'../',manifest:data.manifest,pulse:data.pulse}),/do not authenticate the source/);
});
test('a stopped archive walk can resume with an explicit larger budget without changing its snapshot',async()=>{
  const p=index.posts[0],snapshot=p.id+10,record=d=>({url:'fixture',data:d,bytes:Buffer.from(JSON.stringify(d))});
  const first={now:asOf,snapshot_id:snapshot,pin_snapshot:'',board_total:1,posts:[p],has_more:true,next_before:`${p.created_at}:${p.id}`};
  const last={...first,posts:[],has_more:false,next_before:null};
  await assert.rejects(()=>collectIndex(async()=>record(first),()=>{},1),/incomplete.*max-pages/);
  let calls=0;const resumed=await collectIndex(async()=>record(calls++?last:first),()=>{},2);
  assert.equal(resumed.complete_walk,true);assert.equal(resumed.snapshot_id,snapshot);assert.equal(resumed.posts.length,1);
  calls=0;await assert.rejects(()=>collectIndex(async()=>record(calls++?{...last,snapshot_id:snapshot+1}:first),()=>{},2),/membership changed/);
  assert.equal(pageBudget(['--max-pages=400']),400);
  for(const args of [['--max-pages=0'],['--max-pages=1001'],['--max-pages=abc'],['--max-pages=200','extra']])assert.throws(()=>pageBudget(args));
});
test('release approval is required explicitly on both public deployment jobs',()=>{
  const yaml=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert.equal((yaml.match(/vars\.OBSERVATORY_PUBLIC_RELEASE_APPROVED == 'true'/g)||[]).length,2);
});
test('rendered filter and pagination borders exceed 3:1 against their adjacent backgrounds',()=>{
  const styles=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
  const css=styles+readFileSync(new URL('../public/explore.css',import.meta.url),'utf8');
  const doc=new JSDOM(`<style>${css}</style><div class="explore-choices"><a>Top</a></div><div class="explore-paging"><a>Next</a></div>`);
  const luminance=rgb=>rgb.map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
  const hex=h=>(h.length===3?[...h].map(c=>c+c).join(''):h).match(/../g).map(c=>parseInt(c,16));
  const paper=styles.match(/--paper:\s*#([0-9a-f]{3,6});/)[1],white=styles.match(/--white:\s*#([0-9a-f]{3,6});/)[1];
  for(const a of doc.window.document.querySelectorAll('a')){
    const color=doc.window.getComputedStyle(a).borderTopColor.match(/\d+/g).slice(0,3).map(Number);
    for(const bg of [paper,white]){const x=luminance(color),y=luminance(hex(bg));assert.ok((Math.max(x,y)+.05)/(Math.min(x,y)+.05)>=3);}
  }
  doc.window.close();
});
