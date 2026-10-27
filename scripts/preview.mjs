// 本機預覽 dist/：和 GitHub Pages 一樣把 /about/ 對到 about/index.html，找不到用 404.html。
// 只聽 127.0.0.1。用法：npm run preview（PORT 改埠號；用 BASE_PATH 建置過的話，預覽也設同一個 BASE_PATH）
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {join,extname,normalize,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url)),port=Number(process.env.PORT||8788);
const base='/'+String(process.env.BASE_PATH||'').split('/').filter(Boolean).map(s=>s+'/').join('');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.woff':'font/woff','.txt':'text/plain; charset=utf-8','.xml':'application/xml'};
const notFound=async response=>{response.writeHead(404,{'content-type':types['.html']});response.end(await readFile(join(root,'404.html')).catch(()=>'404'));};
createServer(async(request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');let path;
  try{path=decodeURIComponent(url.pathname);}catch{response.writeHead(400).end();return;}
  if(path+'/'===base){response.writeHead(308,{location:base+url.search}).end();return;}
  if(!path.startsWith(base))return notFound(response);
  const relative=path.slice(base.length-1),file=normalize(join(root,relative.endsWith('/')?relative+'index.html':relative));
  if(!file.startsWith(root.endsWith(sep)?root:root+sep)){response.writeHead(400).end();return;}
  try{
    if((await stat(file)).isDirectory()){response.writeHead(308,{location:path+'/'+url.search}).end();return;}
    response.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});response.end(await readFile(file));
  }catch{return notFound(response);}
}).listen(port,'127.0.0.1',()=>console.log(`預覽：http://127.0.0.1:${port}${base}`));
