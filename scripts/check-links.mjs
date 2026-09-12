import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
const root=resolve('dist'), html=[];
function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,item.name);
  if(item.isDirectory())walk(path);else if(item.name.endsWith('.html'))html.push(path);
}}
walk(root);
const ids=new Map();let count=0;
const base=process.env.SITE_BASE_PATH??'/';
for(const file of html){
  const doc=readFileSync(file,'utf8');
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(doc))throw new Error(`Unsafe display controls in ${relative(root,file)}`);
  for(const match of doc.matchAll(/\b(?:href|src)="([^"]*)"/g)){
    const href=match[1].replaceAll('&amp;','&');
    if(/^(?:https?:|data:|mailto:)/.test(href))continue;
    const url=new URL(href,`https://local.test${base}${relative(root,file).split('\\').join('/')}`);
    if(url.origin!=='https://local.test')throw new Error(`Unexpected URL: ${href}`);
    if(!url.pathname.startsWith(base))throw new Error(`Outside configured base: ${href}`);
    let target=resolve(root,decodeURIComponent(url.pathname.slice(base.length)));
    if(!target.startsWith(root+'/')&&target!==root)throw new Error(`Outside output: ${href}`);
    if(existsSync(target)&&statSync(target).isDirectory())target=join(target,'index.html');
    if(!existsSync(target))throw new Error(`Missing target in ${relative(root,file)}: ${href}`);
    if(url.hash&&target.endsWith('.html')){
      if(!ids.has(target))ids.set(target,new Set([...readFileSync(target,'utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>m[1])));
      if(!ids.get(target).has(decodeURIComponent(url.hash.slice(1))))throw new Error(`Missing anchor: ${href}`);
    }
    count++;
  }
}
console.log(`Verified ${count.toLocaleString('en-GB')} local links/assets/anchors across ${html.length.toLocaleString('en-GB')} HTML files.`);
