// 上一次成功的內容（分頁快照、更新紀錄）存在 .state/state.json，原圖在 .state/images/；
// GitHub Actions 用快取把整個 .state/ 帶到下一次。快取不見時就從頭收錄，不影響網站內容。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {sha256} from './catalog.mjs';
const REVISION_LIMIT=30;
export const emptyState=()=>({tabs:[],revisions:[],next_revision:1,last_success:null});
export async function loadState(dir){
  try{const state=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));return Array.isArray(state.tabs)&&Array.isArray(state.revisions)?state:emptyState();}
  catch{return emptyState();}
}
export async function saveState(dir,state){await mkdir(dir,{recursive:true});await writeFile(join(dir,'state.json'),JSON.stringify(state));}
// 和 Sites 版相同的規則：原文、原圖或連結有變才記一筆版本；變更時間只在內容真的變了才更新。
export async function applySource(state,tabs,now){
  const revisions=[...state.revisions],changed=[],next=[];let id=state.next_revision||1;
  for(const tab of tabs){
    const old=state.tabs.find(t=>t.tab_id===tab.id),hash=await sha256(JSON.stringify([tab.body,tab.attachments,tab.links])),different=!old||old.hash!==hash;
    if(different){
      changed.push(tab.id);
      revisions.push({id:id++,tab_id:tab.id,before_body:old?.body??null,after_body:tab.body,before_hash:old?.hash??null,after_hash:hash,before_assets:old?JSON.stringify(old.attachments):null,after_assets:JSON.stringify(tab.attachments),recorded_at:now});
    }
    next.push({tab_id:tab.id,title:tab.title,body:tab.body,hash,attachments:tab.attachments,links:tab.links,changed_at:different?now:old.changed_at,kind:!old?'baseline':different?'change':old.kind});
  }
  return {state:{tabs:next,revisions:revisions.slice(-REVISION_LIMIT),next_revision:id,last_success:now},changed};
}
// 閱讀頁用來判斷「有新內容」的版本號，只看分頁內容雜湊。
export const documentVersion=state=>sha256(JSON.stringify(state.tabs.map(t=>[t.tab_id,t.hash])));
