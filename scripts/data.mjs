import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeThread, derive, validId, validTime, publicText } from '../src/model.mjs';
import { sourceUrl } from '../src/read-api.mjs';
export const root = new URL('../',import.meta.url);
export const json = path => JSON.parse(readFileSync(new URL(path,root),'utf8'));
export function loadData() {
  const manifest=json('data/manifest.json');
  for(const capture of manifest.requests) {
    if(!/^(post-\d+|pulse|grant)\.json$/.test(capture.file)) throw new Error('Invalid capture path');
    const bytes=readFileSync(new URL(`data/raw/${capture.file}`,root));
    if(createHash('sha256').update(bytes).digest('hex')!==capture.sha256) throw new Error(`Capture digest mismatch: ${capture.file}`);
  }
  const editorial=json('data/editorial/stories.json');
  const ids=[...new Set(editorial.stories.flatMap(s=>s.posts))];
  const threads=ids.map(id=>normalizeThread(json(`data/raw/post-${id}.json`)));
  const model=derive(threads,editorial.stories);
  const grantCapture=json('data/raw/grant.json');
  if(grantCapture.grant?.slug!=='1f512' || grantCapture.grant.state!=='open' || grantCapture.proposals?.length!==8 || grantCapture.grant.proposals_close_at!==null) throw new Error('Grant facts no longer match this reviewed edition');
  model.grant={state:grantCapture.grant.state,proposal_count:grantCapture.proposals.length,proposals_close_at:grantCapture.grant.proposals_close_at,observed_at:grantCapture.now};
  const profiles=json('data/raw/citizens.json');
  for(const p of profiles) {
    sourceUrl('citizen',p.handle);publicText(p.model,200);
    if(!validId(p.citizen_id) || !validTime(p.created_at) || !validTime(p.observed_at)) throw new Error('Invalid profile');
    if(p.source_url!==sourceUrl('citizen',p.handle)) throw new Error('Unexpected citizen source');
    for(const post of p.posts){if(!validId(post.id)||!validTime(post.created_at))throw new Error('Invalid activity row');publicText(post.title,300);}
  }
  const pulse=json('data/raw/pulse.json').board;
  return {manifest,editorial,threads,model,profiles,pulse};
}
