import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { loadData, root } from './data.mjs';
import { JSDOM } from 'jsdom';
import { shell, home, dossier, citizen, method, CSP } from '../src/render.mjs';
import { exploreView } from '../src/explore-render.mjs';
import { loadIndex } from './index-data.mjs';

export function auditSource(source,filename) {
  const errors=[];
  const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
  function walk(node){
    if(!node || typeof node!=='object')return;
    if(node.type==='Identifier' && ['XMLHttpRequest','WebSocket','EventSource','sendBeacon','eval','Function'].includes(node.name)) errors.push(`${filename}: forbidden capability ${node.name}`);
    if(node.type==='ImportExpression')errors.push(`${filename}: dynamic import requires review`);
    if(node.type==='MemberExpression') {
      const prop=node.computed?node.property.value:node.property.name;
      if(['innerHTML','outerHTML','insertAdjacentHTML','write','writeln'].includes(prop))errors.push(`${filename}: unsafe HTML sink ${prop}`);
    }
    if(node.type==='Identifier' && node.name==='fetch' && filename!=='src/read-api.mjs')errors.push(`${filename}: network call outside boundary`);
    if(node.type==='CallExpression' && node.callee.type==='Identifier' && node.callee.name==='fetch') {
      const options=node.arguments[1];const fields=new Map((options?.properties??[]).map(p=>[p.key.name??p.key.value,p.value]));
      for(const [key,value] of [['method','GET'],['credentials','omit'],['redirect','error']]) if(fields.get(key)?.value!==value)errors.push(`${filename}: ${key} must be ${value}`);
    }
    for(const [key,value] of Object.entries(node))if(!['start','end'].includes(key)) {
      if(Array.isArray(value))value.forEach(walk);else if(value && typeof value==='object')walk(value);
    }
  }
  walk(ast);
  return errors;
}
export function auditMarkup(html) {
  const doc=new JSDOM(html).window.document;const errors=[];
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(html))errors.push('Unsafe control or bidi formatting character in HTML');
  if(doc.querySelector('input,textarea,form,select,[contenteditable]'))errors.push('An input-capable field exists');
  if(doc.querySelector('script:not([src])'))errors.push('Inline script exists');
  for(const el of doc.querySelectorAll('*'))for(const attr of el.attributes)if(/^on/i.test(attr.name))errors.push('Inline event handler exists');
  for(const link of doc.querySelectorAll('a[href]')) {
    const url=link.getAttribute('href');
    if(/^javascript:|^data:|^\/\//i.test(url))errors.push('Unsafe navigation URL');
    if(link.getAttribute('target')==='_blank' && !link.rel.includes('noopener'))errors.push('External navigation lacks noopener');
  }
  if(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content!==CSP)errors.push('Missing or changed CSP');
  if(doc.querySelectorAll('main').length!==1 || doc.querySelectorAll('h1').length!==1)errors.push('Expected one main and one h1');
  if(doc.documentElement.lang!=='en')errors.push('Missing language');
  return errors;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const errors=[];
  for(const file of readdirSync(new URL('src/',root)).filter(f=>f.endsWith('.mjs')))errors.push(...auditSource(readFileSync(new URL(`src/${file}`,root),'utf8'),`src/${file}`));
  const {model,manifest,profiles,pulse}=loadData();
  const pages=[home(model,manifest),...model.stories.map(s=>dossier(s,model,manifest)),...profiles.map(p=>citizen(p,model,manifest,profiles)),method(manifest,model)];
  const index=loadIndex();
  pages.push(exploreView({index,rows:index.posts.slice(0,25),total:index.posts.length,pages:1,base:'../',model,profiles}));
  for(const body of pages)errors.push(...auditMarkup(shell({title:'Audit',description:'Audit',body,base:'./',manifest,pulse})));
  for(const name of ['snapshot.mjs','capture-index.mjs']){
    const pipeline=readFileSync(new URL(`scripts/${name}`,root),'utf8');
    if(/\bfetch\s*\(|https?:\/\//.test(pipeline))errors.push('Snapshot pipeline bypasses read boundary');
  }
  if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Audit passed: ${pages.length} page variants; GET-only boundary; no input fields or unsafe HTML sinks.`);
}
