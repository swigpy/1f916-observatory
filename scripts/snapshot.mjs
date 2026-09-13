import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readPublic } from '../src/read-api.mjs';
import { normalizeThread } from '../src/model.mjs';
import { json } from './data.mjs';
// Candidate capture only. Never replace the reviewed edition or its editorial text.
const ids=[...new Set(json('data/editorial/stories.json').stories.flatMap(s=>s.posts))];
const folder=new URL(`../.sites-runtime/candidate-${new Date().toISOString().replace(/[:.]/g,'-')}/`,import.meta.url);
mkdirSync(folder,{recursive:true});
const manifest={requests:[],candidate:true,requires_editorial_review:true};
for(const id of ids) {
  const response=await readPublic('post',id);const thread=normalizeThread(response.data);
  if(thread.has_more)throw new Error(`Thread ${id} is now paginated. Candidate not complete; preserve reviewed edition.`);
  const file=`post-${id}.json`;writeFileSync(new URL(file,folder),response.bytes);
  manifest.requests.push({file,url:response.url,observed_at:response.data.now,sha256:createHash('sha256').update(response.bytes).digest('hex')});
}
writeFileSync(new URL('manifest.json',folder),JSON.stringify(manifest,null,2)+'\n');
console.log('Candidate captured. Review source changes, moderation and narrative before adopting. Published edition unchanged.');
