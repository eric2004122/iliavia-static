// 介紹頁與首頁的呈現資料：把已同步的分頁原文切成卡片欄位，只切分與對位，不改寫來源文字。
// 匯出文字的表格每格以 Tab 開頭，同一格的換行沒有 Tab；優化版每段標題帶「₍ᐢ」裝飾。讀不到的欄位就不顯示。
import {normalize,PRIMARY_TAB,TESTS_TAB,HISTORY_TAB,STREAMS_TAB,MEMES_TAB,QUOTES_TAB} from './catalog.mjs';
import {IMAGE_ALTS} from './profile-image-alts.mjs';
import {units} from './presentation.mjs';
const DATE=/\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/u,URL_TEXT=/https?:\/\/\S+/u,OPEN='(（【「《',CLOSE=')）】」》';

// 依 Tab 分格；第一個非空行是分頁標題，段落標題和分隔線當作表格邊界（null）。
export function cells(body){
  const out=[];let current=null,titled=false;
  for(const raw of (body||'').split(/\r\n|\r|\n/)){
    const text=raw.trim();
    if(!titled){titled=!!text;continue;}
    if(/₍ᐢ/u.test(text)||/^_{4,}$/.test(text)){out.push(null);current=null;}
    else if(raw.startsWith('\t')||current===null){if(current===null&&!text)continue;current=[text];out.push(current);}
    else current.push(text);
  }
  return out.map(cell=>cell&&cell.filter(Boolean));
}
// 表格內依序兩格一組（標籤、內容）；遇到邊界重新對齊。
export function pairs(list){const out=[];let pending=null;for(const cell of list){if(cell===null)pending=null;else if(pending===null)pending=cell;else{out.push([pending.join(' '),cell]);pending=null;}}return out;}
// 只認得已知標籤：標籤格的下一格就是內容。
function labelled(list,labels){const found=new Map();list.slice(0,-1).forEach((cell,i)=>{const key=cell?.length===1&&normalize(cell[0]);if(key&&labels.has(key)&&!found.has(key))found.set(key,list[i+1]||[]);});return found;}
// 用頓號切清單，括號裡的頓號不切。
export function splitList(text,separators='、'){
  const items=[];let depth=0,buffer='';
  for(const c of text||''){if(OPEN.includes(c))depth++;else if(CLOSE.includes(c))depth=Math.max(0,depth-1);if(!depth&&separators.includes(c)){items.push(buffer);buffer='';}else buffer+=c;}
  items.push(buffer);return items.map(s=>s.trim()).filter(Boolean);
}
// 只拆最後一組括號當補充說明，例如「很會狡辯（沒人會聽）」。
export function splitNote(item){const m=item.match(/^(.*\S)\s*[（(]([^（()）]+)[）)]$/u);return m?{text:m[1],note:m[2]}:{text:item,note:''};}
const headline=value=>{const m=value.match(/^([^（(]+?)\s*[（(](.+)[）)]\s*$/u);return m?[m[1],m[2]]:[value,''];};
// 「自稱 195 cm，含 55 cm 的自尊與 10cm 的老爹鞋」有完整數字時才畫身高尺。
export function heightParts(value){
  const claimed=value.match(/自稱\s*(\d{2,3})\s*cm/i),pride=value.match(/(\d{1,3})\s*cm\s*的自尊/i),shoes=value.match(/(\d{1,3})\s*cm\s*的老爹鞋/i);
  if(!claimed||!pride||!shoes)return null;
  const [c,p,s]=[claimed,pride,shoes].map(m=>Number(m[1])),rest=c-p-s;if(rest<=0)return null;
  return {claimed:c,parts:[{tone:'rest',label:`其餘 ${rest} cm`,cm:rest},{tone:'shoes',label:`老爹鞋 ${s} cm`,cm:s},{tone:'pride',label:`自尊 ${p} cm`,cm:p}]};
}
function linkLabel(url){let host='';try{host=new URL(url).hostname.replace(/^www\./,'');}catch{/* 非網址就用通用文字 */}if(host.endsWith('twitch.tv'))return '在 Twitch 開啟';if(host.endsWith('youtube.com')||host==='youtu.be')return '在 YouTube 開啟';return '開啟連結';}
const findLink=(text,links)=>(links||[]).find(l=>l.label===text||l.url===text)?.url||null;
const PROFILE_LABELS=new Set(['姓名 / 別稱','性別','種族','生日','出道日期','宗教信仰','分身','身高','UU','酒量','生理期','性格','外貌特徵','反應','聲音','習慣','身體疾病','過敏原','不喜歡的食物','喜歡的食物','專屬吃法','性癖','興趣','癖好','特殊能力','體能狀況','笨蛋行為','專屬技能','課表與行程','沒拿到的學分','持有證照','事蹟列表','目標列表','潛在原告','口頭禪','嘴ㄆㄧㄚˊ字典'].map(normalize));

function profile(tab){
  const list=cells(tab.body),fields=labelled(list,PROFILE_LABELS),lines=label=>fields.get(normalize(label))||[];
  const text=label=>lines(label).join('\n'),joined=label=>lines(label).join('、');
  const numbered=label=>lines(label).map(l=>l.replace(/^\d{1,3}\s*[.．、]\s*/u,'').replace(/、+$/u,''));
  const stats=['身高','UU','酒量','出道日期'].filter(text).map(label=>{const [head,detail]=headline(text(label));return {label,head,detail};});
  let likesNote='',likes=text('喜歡的食物');
  if(likes.includes('】')){const i=likes.indexOf('】');likesNote=likes.slice(0,i+1);likes=likes.slice(i+1);}
  else if(likes.includes('\n')){const i=likes.indexOf('\n');likesNote=likes.slice(0,i);likes=likes.slice(i+1);}
  const court=lines('潛在原告');
  const typos=text('嘴ㄆㄧㄚˊ字典').split(/[｜|\n]/u).filter(c=>c.includes('➔')).map(c=>{const i=c.indexOf('➔');return {said:c.slice(0,i).trim(),meant:c.slice(i+1).trim()};});
  return {
    aliases:splitList(joined('姓名 / 別稱')),
    basics:['生日','種族','性別','宗教信仰','分身','課表與行程','專屬技能'].filter(text).map(label=>({label,value:text(label)})),
    stats,height:heightParts(text('身高')),height_source:text('身高'),
    traits:['性格','外貌特徵','反應','聲音','習慣','興趣','癖好'].filter(joined).map(label=>({label,entries:splitList(joined(label))})),
    abilities:['特殊能力','體能狀況','笨蛋行為'].filter(joined).map(label=>({label,entries:splitList(joined(label)).map(splitNote)})),
    honors:numbered('事蹟列表').map(splitNote),goals:numbered('目標列表').map(splitNote),
    quotes:splitList(joined('口頭禪')).map(s=>s.replace(/^[「」 ]+|[「」 ]+$/gu,'')).filter(Boolean),
    typos,
    food:{likes_note:likesNote.trim(),likes:splitList(likes.replaceAll('\n','、')),dislikes:splitList(joined('不喜歡的食物')),allergies:splitList(joined('過敏原')),special:splitList(joined('專屬吃法'))},
    health:{conditions:splitList(joined('身體疾病'),'、，'),period:text('生理期')},
    kinks:splitList(joined('性癖')),
    school:['沒拿到的學分','持有證照'].filter(label=>lines(label).length).map(label=>({label,lines:lines(label)})),
    court:{note:court.find(l=>l.startsWith('【')&&l.includes('原告們'))||'',plaintiffs:splitList(court.find(l=>!l.startsWith('【'))||'')},
    cheer:{asset:tab.attachments[0]||null,caption:list.flatMap(c=>c||[]).find(l=>/^[（(].+[)）]$/u.test(l))||''},
  };
}
const tests=tab=>pairs(cells(tab.body)).filter(([,v])=>v.length).map(([label,v])=>{const value=v.join(' ');return {label,value,long:[...label].length>6||[...value].length>14};});
// 編號與內容兩格一組；只有編號、沒有內容的格子不顯示。
function history(tab){
  const events=[];
  for(const [number,v] of pairs(cells(tab.body))){
    if(!/^\d+$/.test(number))continue;
    const body=v.join(' '),url=body.match(URL_TEXT)?.[0]||null,label=body.replace(new RegExp(URL_TEXT.source,'gu'),'').trim();
    if(label||url)events.push({number,text:label||url,url,milestone:label.includes('里程碑')});
  }
  return {events};
}
const streams=tab=>pairs(cells(tab.body)).filter(([,v])=>v.length).map(([label,v])=>{const title=v.length>1?v[1]:v[0].replace(new RegExp(DATE.source,'gu'),'').trim();return {label,title,date:v[0].match(DATE)?.[0]||'',url:findLink(title,tab.links)};});
function sayings(tab){
  const out=[];
  for(const [said,cell] of pairs(cells(tab.body))){
    const text=said.replace(new RegExp(DATE.source,'gu'),'').trim(),linkText=cell.join(' ').trim(),bare=new RegExp('^'+URL_TEXT.source+'$','u').test(linkText);
    const url=findLink(linkText,tab.links)||(bare?linkText:null);
    if(text)out.push({text,date:said.match(DATE)?.[0]||'',url,link_label:url&&!bare?linkText:url?linkLabel(url):''});
  }
  return out;
}
// 站方為梗圖寫的替代文字；沒有就用編號。
export const imageAlt=(asset,index)=>asset.alt||IMAGE_ALTS[asset.object_id]||`共編文件內嵌圖片 ${index}`;
// 原圖以 bytes 的 SHA-256 命名放在 /images/，內容不變網址就不變。
export const imageUrl=(tab,asset)=>'/'+asset.file;

// tabs：model.tabs() 的結果。缺的分頁回傳空值。
export function buildProfile(tabs){
  const get=id=>tabs.find(t=>t.tab_id===id),memes=get(MEMES_TAB);
  return {
    profile:get(PRIMARY_TAB)?profile(get(PRIMARY_TAB)):null,
    tests:get(TESTS_TAB)?tests(get(TESTS_TAB)):[],
    history:get(HISTORY_TAB)?history(get(HISTORY_TAB)):{events:[]},
    streams:get(STREAMS_TAB)?streams(get(STREAMS_TAB)):[],
    sayings:get(QUOTES_TAB)?sayings(get(QUOTES_TAB)):[],
    memes:{assets:memes?.attachments||[],notes:memes?cells(memes.body).flatMap(c=>c||[]):[]},
  };
}
// 介紹頁只放精選：黑歷史取最新幾條，梗圖取前幾張並跳過和應援圖同一張的那張。
export function highlights(data,historyCount=5,memeCount=8){
  const events=data.history.events,cheer=data.profile?.cheer.asset;
  return {history:events.slice(-historyCount),history_total:events.length,memes:data.memes.assets.map((asset,i)=>({asset,index:i+1})).filter(m=>!cheer||m.asset.object_id!==cheer.object_id).slice(0,memeCount),memes_total:data.memes.assets.length};
}
// 首頁與閱讀頁分頁的數量；數到 0 就不給，讓卡片改用原文摘要。
export function tabCounts(data){
  const counts={[PRIMARY_TAB]:[data.profile?.aliases.length||0,'個稱號'],[TESTS_TAB]:[data.tests.length,'項測驗'],[HISTORY_TAB]:[data.history.events.length,'條黑歷史'],[STREAMS_TAB]:[data.streams.length,'回直播'],[MEMES_TAB]:[data.memes.assets.length,'張梗圖'],[QUOTES_TAB]:[data.sayings.length,'句語錄']};
  return Object.fromEntries(Object.entries(counts).filter(([,[count]])=>count).map(([id,[count,unit]])=>[id,{count,unit}]));
}
// 首頁隨機抽一張梗圖或一條黑歷史（里程碑標記不算）。
export function homePick(data,random=Math.random){
  const choices=[...data.memes.assets.map((asset,i)=>({kind:'meme',item:asset,index:i+1})),...data.history.events.filter(e=>!e.milestone).map(item=>({kind:'history',item}))];
  return choices.length?choices[Math.floor(random()*choices.length)]:null;
}

// 把一筆 source_revisions 濃縮成一句話，給首頁「最近更新」用。
export function changeSummary(row,title){
  if(!row.before_hash)return '開始追蹤這一頁';
  const parts=[],paragraphs=body=>units(body||'',row.tab_id,title).filter(b=>b.kind!=='space').map(b=>b.raw);
  if(row.before_body!==row.after_body){
    const before=paragraphs(row.before_body),after=paragraphs(row.after_body),added=after.filter(b=>!before.includes(b)).length,removed=before.filter(b=>!after.includes(b)).length;
    parts.push(added||removed?`新增 ${added} 段、移除 ${removed} 段`:'調整段落順序或格式');
  }
  const ids=json=>{try{return JSON.parse(json||'[]').map(a=>a.object_id);}catch{return [];}};
  const beforeImages=ids(row.before_assets),afterImages=ids(row.after_assets),addedImages=afterImages.filter(id=>!beforeImages.includes(id)).length,removedImages=beforeImages.filter(id=>!afterImages.includes(id)).length;
  if(addedImages||removedImages)parts.push(`圖片新增 ${addedImages}、移除 ${removedImages}`);
  return parts.join('，')||'連結或排序有調整';
}

// 18+／私人內容：欄位標籤（去掉愛心、emoji 後）→ 收合時顯示的分類。只改顯示方式，不刪改原文。
const SENSITIVE_LABELS=new Map([['性癖','18+'],['生理期','私人'],['身體疾病','私人']].map(([label,kind])=>[normalize(label),kind]));
export const sensitiveKind=label=>SENSITIVE_LABELS.get(normalize(label||''))||null;
