import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
export default defineConfig({
  root:'dist',publicDir:false,appType:'mpa',
  server:{host:'0.0.0.0',port:4173,strictPort:true,allowedHosts:['terminal.local','localhost'],hmr:false},
  plugins:[{name:'qa-viewport',configureServer(server){server.middlewares.use((req,res,next)=>{
    if(req.url==='/__qa__/text-size.css'){res.setHeader('content-type','text/css');res.end('html { font-size: 200%; }');return;}
    if(['/?qa=text200','/explore/?qa=text200'].includes(req.url)){res.setHeader('content-type','text/html');res.end(readFileSync(new URL(req.url.startsWith('/explore/')?'./dist/explore/index.html':'./dist/index.html',import.meta.url),'utf8').replace('</head>','<link rel="stylesheet" href="/__qa__/text-size.css"></head>'));return;}
    if(!['/__qa__/mobile','/__qa__/text-zoom','/__qa__/explore-mobile','/__qa__/explore-text-zoom'].includes(req.url))return next();
    const zoom=req.url.endsWith('text-zoom');
    const framePath=req.url.includes('explore-')?'/explore/':'/';
    res.setHeader('content-type','text/html');
    res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${zoom?'200 percent layout':'390px mobile layout'} QA</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#dbe1e6;font-family:system-ui}p{margin:12px 24px;font-size:14px}iframe{display:block;margin:0 24px;border:1px solid #99a9b9;width:${zoom?'640':'390'}px;height:844px}</style></head><body><p>${zoom?'Text enlarged to 200% inside a 640px viewport':'390 × 844 CSS-pixel viewport · layout QA, not device emulation'}</p><iframe title="Observatory ${zoom?'reflow':'mobile'} view" src="${framePath}${zoom?'?qa=text200':''}"></iframe></body></html>`);
  });}}],
});
