import {normalize,PRIMARY_TAB,TAB_PREFIXES} from './catalog.mjs';
const groups={
  '基本資料':'姓名 姓名別稱 性別 種族 生日 出道日期 宗教信仰 分身 身高 UU CPU 身體數值 此筆記頭銜',
  '特徵與個性':'性格 外貌特徵 萌點 反應 聲音 身體疾病 過敏 過敏原 生理期 體能狀況',
  '喜好與日常':'酒量 習慣 不喜歡的食物 喜歡的食物 專屬吃法 性癖 興趣 癖好 課表 課表與行程 不擅長遊戲',
  '能力與紀錄':'能力 特殊能力 笨蛋行為 笨蛋行為學 專屬技能 技能 沒拿到的學分 持有證照 證照 事蹟列表 榮譽榜 目標列表 目標 潛在原告 開庭紀錄 口頭禪 嘴ㄆㄧㄚˊ字典 嘴ㄆㄧㄚˊ紀錄',
};
const fields=new Map(Object.entries(groups).flatMap(([g,labels])=>labels.split(' ').map(l=>[normalize(l),g])));
const tests=new Set(['十六型人格','二次元屬性','戀愛腦','女生最討厭的男生類型二選一','SBTI','色盲測驗','情侶最不能接受二選一'].map(normalize));
const pinned=s=>/^[♡❤♥\s]*📌/u.test(s)&&s.length<=90;

export function units(body,tab,title) {
  const lines=[...body.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)].filter(m=>m[0]).map(m=>({raw:m[0],start:m.index,end:m.index+m[0].length,text:m[0].trim()}));
  const first=lines.findIndex(l=>l.text);
  const profile=tab===PRIMARY_TAB||lines.filter(l=>fields.has(normalize(l.text))).length>=2;
  const numberCount=lines.filter(l=>/^\d{1,5}(?:[.．、)）]\s*.*)?$/.test(l.text)).length;
  const types=lines.map((l,i)=>{
    const s=l.text,n=normalize(s);
    if(!s) return {kind:'space'};
    if(!pinned(s)&&(fields.has(n)||(tab==='t.gbcaaxqgbkej'&&tests.has(n)))) return {kind:'field',group:tab==='t.gbcaaxqgbkej'?'測驗結果':fields.get(n),label:s,split:l.end};
    if(pinned(s)||/^#{1,6}\s+/.test(s)||/^【[^\r\n]{1,60}】$/.test(s)||(i===first&&s.length<=120&&(n===normalize(title)||s.includes('筆記')||s.includes('測驗結果')||s.includes('黑歷史')))) return {kind:'heading',heading:s.replace(/^#{1,6}\s+/, '')};
    const numbered=s.match(/^(\d{1,5})(?:[.．、)）]\s*(.*))?$/);
    if(!profile&&numbered&&(tab==='t.nzf45lbshn11'||numberCount>=2||numbered[2]))return {kind:'event',number:numbered[1],inline:numbered[2]||''};
    const inline=l.raw.match(/^[\t ]*([^:：\t\r\n]{1,24}?)([\t ]*[:：][\t ]*|\t+)(.*)/);
    if(!pinned(s)&&inline&&!['http','https','ftp','mailto'].includes(normalize(inline[1])))return {kind:'field',label:inline[1].trim(),split:l.start+inline[0].length-inline[3].length,group:fields.get(normalize(inline[1]))||'資料欄位'};
    if(/^[♡❤♥]/u.test(s)&&[...s].filter(c=>'♡❤♥'.includes(c)).length===1&&s.length<=60&&/[\p{L}\p{N}]/u.test(s))return {kind:'field',label:s,split:l.end,group:'資料欄位'};
    return {kind:'paragraph'};
  });
  const result=[];
  for(let i=0;i<lines.length;){
    const type=types[i];let j=i+1;
    if(type.kind==='event')while(j<lines.length&&!['heading','event'].includes(types[j].kind))j++;
    else if(type.kind==='field')while(j<lines.length&&!['field','heading','event'].includes(types[j].kind))j++;
    else if(type.kind==='space')while(j<lines.length&&types[j].kind==='space')j++;
    else if(type.kind==='paragraph')while(j<lines.length&&types[j].kind==='paragraph')j++;
    const start=lines[i].start,end=lines[j-1].end;
    result.push({...type,start,end,raw:body.slice(start,end),hidden:type.kind==='event'&&!type.inline.trim()&&!lines.slice(i+1,j).some(l=>l.text)});i=j;
  }
  return result;
}

export function presentation(body,tab,title,query='') {
  const blocks=units(body,tab,title),sections=[];
  for(const b of blocks){
    const kind=b.kind==='field'?'fields':b.kind==='event'?'events':'prose';
    const label=b.heading||b.group||(b.kind==='event'?`第 ${b.number} 項`:'原文');
    const previous=sections.at(-1);
    const create=!previous||(b.kind!=='space'&&(b.kind==='heading'||b.kind==='event'||previous.kind!==kind||(kind==='fields'&&previous.title!==label)));
    // Preserve Flask bookmarks: the old offset counts Unicode code points.
    if(create){
      const results=tab==='t.gbcaaxqgbkej'&&kind==='fields';
      const previousBlock=previous?.blocks.toReversed().find(block=>block.kind!=='space');
      const duplicateHeading=kind==='fields'&&previousBlock?.kind==='heading'&&normalize(previousBlock.raw).startsWith(normalize(label));
      sections.push({id:`section-${TAB_PREFIXES[tab]||tab.replace(/[^a-z0-9]/gi,'')}-${[...body.slice(0,b.start)].length}`,kind,title:label,hidden:!!b.hidden,blocks:[],start:b.start,end:b.end,results,show_title:!(kind==='fields'&&(results||duplicateHeading))});
    }
    sections.at(-1).blocks.push(b);sections.at(-1).end=b.end;
  }
  const matches=[];
  if(query){
    const escaped=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    for(const m of body.matchAll(new RegExp(escaped,'giu'))){
      const section=sections.find(s=>s.start<=m.index&&s.end>m.index);
      if(section&&!section.hidden){const from=Math.max(section.start,m.index-38);matches.push({id:`match-${matches.length+1}`,start:m.index,end:m.index+m[0].length,text:m[0],section_id:section.id,snippet:body.slice(from,Math.min(section.end,m.index+m[0].length+60)),snippet_start:from});}
    }
  }
  return {sections,matches,toc:sections.filter(s=>!s.hidden).map(s=>({id:s.id,title:s.title})),excerpt:excerpt(blocks,title)};
}
export function excerpt(blocks,title,max=180){
  const candidates=blocks.filter(b=>!b.hidden&&!['space','heading'].includes(b.kind)).flatMap(b=>b.raw.split(/\r?\n\s*\r?\n/)).map(s=>s.trim()).filter(s=>/[\p{L}\p{N}]/u.test(s)&&normalize(s)!==normalize(title));
  for(const s of candidates){if(s.length<=max)return s;const sentence=s.match(/^.*?[。！？!?](?:[」』”’]*)/su)?.[0];if(sentence&&sentence.length<=max)return sentence;}
  return candidates[0]?.match(/^.*?[。！？!?](?:[」』”’]*)/su)?.[0]||candidates[0]||'';
}
// 讓瀏覽器端搜尋用的文字：只收看得到的段落（空的黑歷史編號不算），段落之間用換行隔開。
export const searchableText=(body,tab,title)=>presentation(body,tab,title).sections.filter(s=>!s.hidden).map(s=>body.slice(s.start,s.end)).join('\n');
