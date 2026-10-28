// 把 .state/ 的內容寫成 dist/ 靜態網站：網頁、原圖、瀏覽器端要用的 JSON。發布到 GitHub Pages。
import {rm,mkdir,cp,writeFile,copyFile,access,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {TABS,MEMES_TAB} from './catalog.mjs';
import {searchableText} from './presentation.mjs';
import {buildProfile,tabCounts,homePick,changeSummary,imageAlt,imageUrl} from './profile.mjs';
import {documentVersion} from './state.mjs';
import {imageSize} from './image-size.mjs';
import * as view from './views.mjs';

// 網站設定只用環境變數（GitHub Actions 的 Variables）：
// SEARCH_INDEXING=1 才讓搜尋引擎收錄；CONTACT_EMAIL 選填；SITE_URL 只在允許收錄時用來產生 sitemap。
// BASE_PATH 由 GitHub Pages 自動給（專案網址是 /repo名稱/）；本機預覽不設就是 /。
export function siteOptions(env={}){
  const email=/^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i.test(env.CONTACT_EMAIL||'')?env.CONTACT_EMAIL:'';
  let siteUrl='';try{const u=new URL(env.SITE_URL||'');if(u.protocol==='https:')siteUrl=u.origin;}catch{/* 沒設就不產生 sitemap */}
  const segments=String(env.BASE_PATH||'').split('/').filter(Boolean);
  if(segments.some(s=>!/^[A-Za-z0-9._-]+$/.test(s)||/^\.+$/.test(s)))throw new Error('BASE_PATH 格式不正確。');
  return {searchIndexing:env.SEARCH_INDEXING==='1',contactEmail:email,siteUrl,base:'/'+segments.map(s=>s+'/').join('')};
}
// 版面裡的站內網址都從 / 開始，這裡統一加上前綴。原文都已轉義（" 變成 &quot;），所以只會改到版面自己的屬性。
export const withBase=(html,base)=>base==='/'?html:html.replace(/(\s(?:href|src|action|data-[a-z-]+-url)=")\/(?!\/)/g,'$1'+base);
const exists=path=>access(path).then(()=>true,()=>false);

export async function writeSite(state,{outDir,stateDir,publicDir,env={},log=()=>{}}){
  const opts=siteOptions(env),base=opts.base,at=path=>base+path.replace(/^\//,'');
  const tabs=TABS.flatMap(t=>{const s=state.tabs.find(x=>x.tab_id===t.id);return s?[{...s,title:t.title}]:[];});
  if(!tabs.length)throw new Error('還沒有任何分頁內容，無法產生網站。');
  // 原圖寬高：給 <img> 的 width／height，版面先預留位置
  const files=[...new Set(tabs.flatMap(t=>t.attachments.map(a=>a.file)))],available=[];
  opts.sizes=new Map();
  for(const file of files){
    if(!await exists(join(stateDir,file))){log(`找不到原圖 ${file}，這張圖這次不會顯示。`);continue;}
    available.push(file);const size=imageSize(await readFile(join(stateDir,file)));if(size)opts.sizes.set(file,size);
  }
  await rm(outDir,{recursive:true,force:true});
  await cp(publicDir,outDir,{recursive:true});
  const page=async(path,html)=>{const file=join(outDir,path,'index.html');await mkdir(dirname(file),{recursive:true});await writeFile(file,withBase(html,base));};
  const data=buildProfile(tabs),counts=tabCounts(data),kinds=Object.fromEntries(tabs.map(t=>[t.tab_id,t.kind])),version=await documentVersion(state),updatedAt=state.last_success;
  const revisions=[...state.revisions].reverse();
  const changes=revisions.slice(0,3).map(r=>{const title=TABS.find(t=>t.id===r.tab_id)?.title||r.tab_id;return {tab_id:r.tab_id,title,recorded_at:r.recorded_at,summary:changeSummary(r,title)};});
  const reader={tabs,updatedAt,version,counts,kinds};

  await page('',view.home({tabs,profile:data,counts,pick:homePick(data),changes,kinds},opts));
  await page('profile',view.profile(data,updatedAt,opts));
  await page('document',view.documentReader({...reader,selected:tabs[0],isIndex:true},opts));
  for(const tab of tabs)await page(`document/${tab.tab_id}`,view.documentReader({...reader,selected:tab},opts));
  await page('document/changes',view.changes(revisions,updatedAt,opts));
  await page('settings',view.settings(opts));
  await page('about',view.about(opts));
  await writeFile(join(outDir,'404.html'),withBase(view.notFound(opts),base));

  // 原圖：只放目前分頁用到的
  await mkdir(join(outDir,'images'),{recursive:true});
  for(const file of available)await copyFile(join(stateDir,file),join(outDir,file));

  // 瀏覽器端用的資料：版本（有新內容提示）、搜尋文字、口頭禪、隨機抽
  await mkdir(join(outDir,'data'),{recursive:true});
  const json=(name,value)=>writeFile(join(outDir,'data',name),JSON.stringify(value));
  await json('state.json',{available:true,version,last_success:updatedAt});
  await json('search.json',{tabs:tabs.map(t=>({id:t.tab_id,title:t.title,path:at(view.tabPath(t.tab_id)),text:searchableText(t.body,t.tab_id,t.title)}))});
  await json('quotes.json',data.profile?.quotes||[]);
  await json('picks.json',[...data.memes.assets.map((asset,i)=>({kind:'meme',url:at(imageUrl(MEMES_TAB,asset)),alt:imageAlt(asset,i+1),size:opts.sizes.get(asset.file)||null})),...data.history.events.filter(e=>!e.milestone).map(e=>({kind:'history',number:e.number,text:e.text,url:e.url}))]);

  const pages=['/','/profile/','/document/',...tabs.map(t=>view.tabPath(t.tab_id)),'/about/'].map(at);
  await writeFile(join(outDir,'robots.txt'),opts.searchIndexing?`User-agent: *\nDisallow: ${at('/data/')}\n${opts.siteUrl?`Sitemap: ${opts.siteUrl}${at('/sitemap.xml')}\n`:''}`:'User-agent: *\nDisallow: /\n');
  if(opts.searchIndexing&&opts.siteUrl)await writeFile(join(outDir,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(p=>`<url><loc>${view.h(opts.siteUrl+p)}</loc></url>`).join('')}</urlset>`);
}
