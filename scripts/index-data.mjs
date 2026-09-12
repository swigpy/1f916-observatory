import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { indexPost } from '../src/explore.mjs';
import { sourceUrl } from '../src/read-api.mjs';
const dir=new URL('../data/index/',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function loadIndex() {
  const manifest=JSON.parse(readFileSync(new URL('manifest.json',dir)));
  if(manifest.complete_walk!==true || !manifest.requests.length)throw new Error('Index is not a completed archive walk');
  const sourceRows=new Map();let previous;
  for(const request of manifest.requests){
    if(!/^page-\d{3}\.json$/.test(request.file))throw new Error('Invalid index capture path');
    const bytes=readFileSync(new URL(`raw/${request.file}`,dir));
    if(hash(bytes)!==request.sha256)throw new Error('Index source digest mismatch');
    const page=JSON.parse(bytes);
    const expectedUrl=sourceUrl('newest',previous?{before:previous.next_before,snapshot_id:manifest.snapshot_id,pin_snapshot:manifest.pin_snapshot}:{});
    if(request.url!==expectedUrl)throw new Error('Index cursor chain mismatch');
    if(page.snapshot_id!==manifest.snapshot_id || page.pin_snapshot!==manifest.pin_snapshot || (previous&&!previous.has_more))throw new Error('Inconsistent index membership');
    for(const p of page.posts)if(!sourceRows.has(p.id))sourceRows.set(p.id,indexPost(p));
    previous=page;
  }
  if(previous.has_more!==false)throw new Error('Incomplete archive walk');
  const bytes=readFileSync(new URL('posts.json',dir));
  if(hash(bytes)!==manifest.projection_sha256)throw new Error('Index projection digest mismatch');
  const posts=JSON.parse(bytes).map(indexPost);
  if(posts.length!==manifest.returned||new Set(posts.map(p=>p.id)).size!==posts.length||sourceRows.size!==posts.length||posts.some(p=>JSON.stringify(p)!==JSON.stringify(sourceRows.get(p.id))))throw new Error('Inconsistent index projection');
  return {manifest,posts};
}
