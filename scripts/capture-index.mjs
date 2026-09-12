/** Explicit public GET archive walk. Never scheduled or auto-published. */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readPublic, sourceUrl } from '../src/read-api.mjs';
import { indexPost } from '../src/explore.mjs';

export async function collectIndex(read,save=()=>{}) {
  const posts=new Map(),requests=[];let cursor={},snapshot,pins,boardTotal,firstTime,lastTime;
  const seenCursors=new Set();
  for(let page=1;page<=100;page++) {
    const result=await read('newest',cursor),d=result.data;
    if(!Array.isArray(d.posts)||typeof d.has_more!=='boolean'||!Number.isSafeInteger(d.now)||!Number.isSafeInteger(d.snapshot_id)||typeof d.pin_snapshot!=='string'||!Number.isSafeInteger(d.board_total))throw new Error('Invalid archive page');
    if(page===1){snapshot=d.snapshot_id;pins=d.pin_snapshot;boardTotal=d.board_total;firstTime=d.now;}
    if(d.snapshot_id!==snapshot||d.pin_snapshot!==pins)throw new Error('Archive membership changed');
    lastTime=d.now;
    for(const raw of d.posts){
      const p=indexPost(raw);if(p.id>snapshot)throw new Error('Post outside snapshot');
      if(posts.has(p.id)&&!pins.split(',').includes(String(p.id)))throw new Error('Duplicate unpinned post');
      if(!posts.has(p.id))posts.set(p.id,p);
    }
    const file=`page-${String(page).padStart(3,'0')}.json`;
    await save(file,result.bytes);
    requests.push({file,url:result.url,observed_at:d.now,sha256:createHash('sha256').update(result.bytes).digest('hex')});
    if(!d.has_more)return {schema_version:1,snapshot_id:snapshot,pin_snapshot:pins,board_total:boardTotal,capture_started_at:firstTime,capture_finished_at:lastTime,as_of:firstTime,complete_walk:true,returned:posts.size,requests,posts:[...posts.values()]};
    if(typeof d.next_before!=='string'||seenCursors.has(d.next_before))throw new Error('Non-advancing archive cursor');
    seenCursors.add(d.next_before);cursor={before:d.next_before,snapshot_id:snapshot,pin_snapshot:pins};
  }
  throw new Error('Archive exceeded the bounded 100-page budget');
}
if(process.argv[1]?.endsWith('/capture-index.mjs')) {
  const dir=new URL('../.sites-runtime/index-candidate/',import.meta.url);
  if(existsSync(new URL('manifest.json',dir)))throw new Error('Existing capture requires a reviewed replacement; do not overwrite');
  mkdirSync(new URL('raw/',dir),{recursive:true});
  let requestedPage=0;
  const result=await collectIndex(async(kind,key)=>{
    const cached=new URL(`raw/page-${String(++requestedPage).padStart(3,'0')}.json`,dir);
    if(existsSync(cached)){const bytes=readFileSync(cached);return {url:sourceUrl(kind,key),bytes,data:JSON.parse(bytes)};}
    // Pace the history walk. A 429 stops it; resume explicitly after waiting.
    await new Promise(resolve=>setTimeout(resolve,5000));
    const r=await readPublic(kind,key);console.log(`Read page at ${r.data.next_before??'end'}; ${r.data.posts?.length} rows`);return r;
  },(file,bytes)=>{const path=new URL(`raw/${file}`,dir);if(!existsSync(path))writeFileSync(path,bytes,{flag:'wx'});});
  const {posts,...manifest}=result;
  const bytes=Buffer.from(JSON.stringify(posts)+'\n');
  manifest.projection_sha256=createHash('sha256').update(bytes).digest('hex');
  writeFileSync(new URL('posts.json',dir),bytes,{flag:'wx'});
  writeFileSync(new URL('manifest.json',dir),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  console.log(`Complete: ${posts.length} visible posts, ${manifest.requests.length} public GETs`);
}
