// 唯讀取得固定 Google 文件：TXT 是原文，HTML 只用來取原圖與連結，兩邊文字必須一致。
// 不帶 Cookie、不登入，只跟著 Google 自己的固定匯出網址轉址。
import {Parser} from 'htmlparser2';
import {TABS,DOCUMENT_ID,sha256,safeLink} from './catalog.mjs';
const TXT_LIMIT=5*1024*1024,HTML_LIMIT=60*1024*1024,IMAGE_LIMIT=10*1024*1024,TOTAL_IMAGES=40*1024*1024,MEDIA_ATTEMPTS=2;
// 梗圖分頁的 HTML 匯出約 35 MB，慢的網路要一兩分鐘才下載完
const TIMEOUT={txt:30000,html:180000};
export const EXTENSIONS={'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp'};
export class SourceError extends Error {constructor(){super('來源讀取或格式驗證失敗，保留上次成功內容。');}}
export function allowedRedirect(target,tab,format){
  if(target.protocol!=='https:'||target.username||target.password||target.port||target.hash||target.href.includes('\\')||target.searchParams.getAll('tab').length!==1||target.searchParams.get('tab')!==tab||target.searchParams.getAll('format').length!==1||target.searchParams.get('format')!==format||[...target.searchParams.keys()].some(k=>!['tab','format'].includes(k)))return false;
  if(target.hostname==='docs.google.com')return target.pathname===`/document/d/${DOCUMENT_ID}/export`;
  // Google 的 TXT 匯出會轉到短效的 docstext 網址；只接受從固定匯出網址轉過去的。
  return format==='txt'&&/^doc-[a-z0-9-]+-docstext\.googleusercontent\.com$/.test(target.hostname)&&target.pathname.startsWith('/export/');
}
export function validateText(tab,text){
  const expected=TABS.find(t=>t.id===tab);if(!expected||typeof text!=='string'||text.includes('\0')||new TextEncoder().encode(text).length>TXT_LIMIT)throw new SourceError();
  const heading=text.split(/\r?\n/).find(l=>l.trim())?.replace(/\s/g,'')||'';
  if(!expected.expected.some(h=>heading.toLowerCase().includes(h.toLowerCase())))throw new SourceError();
}
export function validImage(bytes,mime){
  const ascii=(start,end)=>String.fromCharCode(...bytes.slice(start,end));
  if(mime==='image/png')return bytes.length>=33&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&ascii(12,16)==='IHDR'&&ascii(bytes.length-8,bytes.length-4)==='IEND';
  if(mime==='image/jpeg')return bytes.length>20&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217;
  if(mime==='image/gif')return bytes.length>14&&['GIF87a','GIF89a'].includes(ascii(0,6))&&bytes.at(-1)===59;
  if(mime==='image/webp')return bytes.length>=20&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'&&new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true)+8===bytes.length;
  return false;
}
function exportParser(expected){
  let inBody=false,ignored=0,rawText='',link=null;const images=[],links=[];
  const parser=new Parser({
    onopentag(name,attrs){
      if(name==='body')inBody=true;if(!inBody)return;
      if(['script','style'].includes(name))ignored++;
      if(name==='svg')throw new SourceError();
      if(ignored)return;
      if(name==='hr')rawText+='␞';
      if(name==='img'){
        const m=attrs.src?.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=\r\n\t ]+)$/);
        if(!m||attrs.srcset||m[2].length>IMAGE_LIMIT*1.4)throw new SourceError();
        let bytes;try{bytes=Uint8Array.from(atob(m[2].replace(/\s/g,'')),c=>c.charCodeAt(0));}catch{throw new SourceError();}
        if(bytes.length>IMAGE_LIMIT||!validImage(bytes,m[1]))throw new SourceError();
        images.push({bytes,mime:m[1],alt:attrs.alt||''});
      }
      if(name==='a')link={url:safeLink(attrs.href),label:''};
    },
    ontext(text){if(inBody&&!ignored){rawText+=text;if(link)link.label+=text;}},
    onclosetag(name){if(name==='a'&&link){if(link.url&&!links.some(l=>l.url===link.url&&l.label===link.label))links.push(link);link=null;}if(['script','style'].includes(name))ignored=Math.max(0,ignored-1);if(name==='body')inBody=false;},
  },{decodeEntities:true});
  return {parser,finish(){
    const norm=s=>s.replace(/\s/g,'');
    const normalizedExpected=expected.replace(/^[\t ]*_{16}[\t ]*\r?$/gm,'␞');
    if(norm(rawText)!==norm(expected)&&norm(rawText)!==norm(normalizedExpected))throw new SourceError();
    if(links.length>500)throw new SourceError();return {images,links};
  }};
}
export function parseExport(html,expected){const p=exportParser(expected);p.parser.write(html);p.parser.end();return p.finish();}
async function fetchExport(tab,format,limit,fetcher,expected){
  let url=`https://docs.google.com/document/d/${DOCUMENT_ID}/export?format=${format}&tab=${encodeURIComponent(tab)}`;
  for(let redirect=0;redirect<4;redirect++){
    const response=await fetcher(url,{headers:{Accept:format==='txt'?'text/plain':'text/html','User-Agent':'Iliavia-ReadOnlySync/2.0'},credentials:'omit',redirect:'manual',signal:AbortSignal.timeout(TIMEOUT[format])});
    if([301,302,303,307,308].includes(response.status)){
      let target;try{target=new URL(response.headers.get('location'),url);}catch{throw new SourceError();}
      if(!allowedRedirect(target,tab,format))throw new SourceError();
      await response.body?.cancel();url=target.href;continue;
    }
    const mime=response.headers.get('content-type')?.split(';')[0].trim();
    if(!response.ok||mime!==(format==='txt'?'text/plain':'text/html')||Number(response.headers.get('content-length'))>limit)throw new SourceError();
    const reader=response.body.getReader(),chunks=[],stream=format==='html'?exportParser(expected):null,decoder=stream?new TextDecoder('utf-8',{fatal:true}):null;let total=0;
    // HTML 邊收邊解析，不把幾十 MB 的 base64 字串整個留在記憶體裡。
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();throw new SourceError();}if(stream)stream.parser.write(decoder.decode(value,{stream:true}));else chunks.push(value);}
    if(stream){stream.parser.end(decoder.decode());return {document:stream.finish(),bytes:total};}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    try{return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^﻿/,''),bytes:total};}catch{throw new SourceError();}
  }
  throw new SourceError();
}
// 圖片匯出（HTML）容易逾時：失敗就再試一次。
async function fetchMedia(tab,limit,fetcher,expected){
  for(let attempt=1;;attempt++){
    try{return await fetchExport(tab,'html',limit,fetcher,expected);}
    catch(error){if(attempt>=MEDIA_ATTEMPTS)throw error;}
  }
}
// previous：上一次成功的分頁（tab_id → {attachments, links}），圖片匯出失敗時沿用。
// 回傳的 images 是「檔名 → 原圖 bytes」，原圖不轉檔、不重繪。
export async function fetchSource({previous=new Map(),fetcher=fetch}={}){
  const tabs=[],images=new Map(),hashes=new Set(),warnings=[];let textBytes=0,htmlBytes=0,imageBytes=0;
  for(const tab of TABS){
    const raw=await fetchExport(tab.id,'txt',TXT_LIMIT-textBytes,fetcher);textBytes+=raw.bytes;validateText(tab.id,raw.text);
    const digest=await sha256(raw.text);if(hashes.has(digest))throw new SourceError();hashes.add(digest);
    let exported;
    try{exported=await fetchMedia(tab.id,HTML_LIMIT-htmlBytes,fetcher,raw.text);}
    catch{
      // 文字照樣更新，這一頁的圖片與原文連結沿用上一次成功的版本，下次再補。
      warnings.push(tab.id);tabs.push({id:tab.id,title:tab.title,body:raw.text,attachments:previous.get(tab.id)?.attachments||[],links:previous.get(tab.id)?.links||[]});continue;
    }
    htmlBytes+=exported.bytes;const attachments=[];
    for(const image of exported.document.images){
      imageBytes+=image.bytes.length;if(imageBytes>TOTAL_IMAGES)throw new SourceError();
      const hash=await sha256(image.bytes),file=`images/${hash}.${EXTENSIONS[image.mime]}`;
      images.set(file,image.bytes);attachments.push({object_id:hash,file,content_type:image.mime,alt:image.alt});
    }
    tabs.push({id:tab.id,title:tab.title,body:raw.text,attachments,links:exported.document.links});
  }
  return {tabs,images,mediaFailures:warnings};
}
