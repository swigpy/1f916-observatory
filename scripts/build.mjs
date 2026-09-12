import { mkdirSync, writeFileSync, readFileSync, readdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, root } from './data.mjs';
import { shell, home, dossier, citizen, method, CSP } from '../src/render.mjs';
import { zip } from './zip.mjs';
import { loadIndex } from './index-data.mjs';
import { SORTS, PERIODS, TOPICS, indexPages, exploreStats } from '../src/explore.mjs';
import { exploreView } from '../src/explore-render.mjs';
const rootPath=fileURLToPath(root),out=join(rootPath,'dist');
const {manifest,model,profiles,pulse}=loadData();
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
const write=(path,body)=>{const p=join(out,path);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,body);};
const page=(path,title,description,body,base,active,observedAt)=>write(path,shell({title,description,body,base,active,manifest,pulse,observedAt}));
page('index.html','A society, in three stories','Understand what AI citizens are building, debating and changing on 1F916. Three sourced stories, with the evidence in view.',home(model,manifest),'./','stories');
for(const s of model.stories)page(`stories/${s.slug}/index.html`,s.title,s.deck,dossier(s,model,manifest),'../../','story');
for(const p of profiles)page(`citizens/${p.handle}/index.html`,p.handle+' in context',`Public contributions by ${p.handle}, placed in the context of this observatory's selected stories.`,citizen(p,model,manifest,profiles),'../../','citizen');
page('method/index.html','How we know','The sources, deterministic transformations and editorial choices behind this edition.',method(manifest,model),'../','method');
const index=loadIndex(),stats=exploreStats(index.posts,index.manifest.as_of);let exploreCount=0;
for(const topic of Object.keys(TOPICS))for(const sort of Object.keys(SORTS))for(const period of Object.keys(PERIODS)){
  const chunks=indexPages(index.posts,{topic,sort,period,asOf:index.manifest.as_of});
  const total=chunks.reduce((n,p)=>n+p.length,0);
  for(let i=0;i<chunks.length;i++){
    const options={index,rows:chunks[i],total,pages:chunks.length,page:i+1,topic,sort,period,base:'../../../../../',model,profiles,stats};
    page(`explore/${topic}/${sort}/${period}/${i+1}/index.html`,`${TOPICS[topic]} · ${SORTS[sort]} · ${PERIODS[period]}`,`Explore captured public conversations by topic, sort and publication date.`,exploreView(options),options.base,'explore',index.manifest.as_of);exploreCount++;
    if(topic==='all'&&sort==='hot'&&period==='week'&&i===0)page('explore/index.html','Explore the society','Look beyond the selected stories.',exploreView({...options,base:'../'}),'../','explore',index.manifest.as_of);
  }
}
write('evidence/index-manifest.json',JSON.stringify(index.manifest,null,2)+'\n');
const base=process.env.SITE_BASE_PATH??'/';
if(!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))throw new Error('Invalid SITE_BASE_PATH');
page('404.html','Story not found','That page is not part of this edition.',`<div class="page error-page"><p class="eyebrow">OUTSIDE THIS EDITION</p><h1>That page is not here.</h1><p>The source may still exist, but this address does not belong to a story in the current edition.</p><p><a href="${base}">Return to the three stories →</a></p></div>`,base,'none');
cpSync(join(rootPath,'public'),out,{recursive:true});
for(const name of ['app.mjs','model.mjs','read-api.mjs'])write(name,readFileSync(join(rootPath,'src',name)));
write('evidence/manifest.json',JSON.stringify(manifest,null,2)+'\n');
write('evidence/derived.json',JSON.stringify({schema_version:1,scope:'Selected captured threads only; explicit # references do not imply agreement or independent evidence.',stories:model.stories.map(s=>({slug:s.slug,posts:s.posts,post_count:s.post_count,comment_count:s.comment_count,participant_count:s.participant_count,complete_threads:s.complete_threads,latest_selected_at:s.latest_at,citations:s.citations}))},null,2)+'\n');
for(const name of ['api-inventory.md','research.md','explore-method.md'])if(existsSync(join(rootPath,'docs',name)))write(`evidence/${name}`,readFileSync(join(rootPath,'docs',name)));
write('_headers',`/*\n  Content-Security-Policy: ${CSP}; frame-ancestors 'none'\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`);
write('.nojekyll','');
const files=[];
function collect(path){for(const item of readdirSync(join(rootPath,path),{withFileTypes:true})){const p=join(path,item.name);if(item.isDirectory())collect(p);else if(item.isFile())files.push([p,readFileSync(join(rootPath,p))]);}}
for(const dir of ['src','public','scripts','test','docs','data','.github'])if(existsSync(join(rootPath,dir)))collect(dir);
for(const file of ['README.md','AGENTS.md','LICENSE','package.json','package-lock.json','vite.config.mjs','.gitignore'])if(existsSync(join(rootPath,file)))files.push([file,readFileSync(join(rootPath,file))]);
write('source.zip',zip(files));
console.log(`Built ${model.stories.length} stories, ${profiles.length} citizen pages and ${exploreCount} archive views. No network used.`);
