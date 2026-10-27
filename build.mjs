// 讀取固定 Google 文件 → 更新 .state/（上一次的內容與原圖）→ 產生 dist/ 靜態網站。
// 用法：node build.mjs            讀 Google 文件並產生網站
//       node build.mjs --offline  不連網，只用 .state/ 裡上一次的內容重新產生網頁（改版面時用）
// 在 GitHub Actions 裡會把 changed=true/false 寫進 GITHUB_OUTPUT，內容沒變就不重新發布。
import {readdir,rm,mkdir,writeFile,appendFile,access} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {fetchSource,SourceError} from './src/source.mjs';
import {loadState,saveState,applySource} from './src/state.mjs';
import {writeSite} from './src/site.mjs';
const ROOT=dirname(fileURLToPath(import.meta.url));
const exists=path=>access(path).then(()=>true,()=>false);

export async function build({root=ROOT,stateDir=join(root,'.state'),outDir=join(root,'dist'),offline=false,fetcher=fetch,env=process.env,now=new Date().toISOString(),log=console.log}={}){
  let state=await loadState(stateDir),changed=[],mediaFailures=[];
  const fresh=!state.tabs.length;
  if(offline){if(fresh)throw new Error('.state/ 裡沒有上一次的內容，不能離線產生網頁。');}
  else{
    // TXT 失敗會整個丟出 SourceError：不寫 .state/、不產生網站，線上網站維持原樣。
    const source=await fetchSource({previous:new Map(state.tabs.map(t=>[t.tab_id,t])),fetcher});
    mediaFailures=source.mediaFailures;
    const images=join(stateDir,'images');
    await mkdir(images,{recursive:true});
    for(const [file,bytes] of source.images)if(!await exists(join(stateDir,file)))await writeFile(join(stateDir,file),bytes);
    ({state,changed}=await applySource(state,source.tabs,now));
    // 只留目前分頁還在用的原圖
    const used=new Set(state.tabs.flatMap(t=>t.attachments.map(a=>a.file.slice('images/'.length))));
    for(const name of await readdir(images))if(!used.has(name))await rm(join(images,name));
    await saveState(stateDir,state);
  }
  await writeSite(state,{outDir,stateDir,publicDir:join(root,'public'),env,log});
  return {changed:fresh||changed.length>0,changedTabs:changed,mediaFailures,tabs:state.tabs.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const result=await build({offline:process.argv.includes('--offline')});
    // 只印統計，不印原文
    console.log(JSON.stringify({tabs:result.tabs,changed:result.changed,changed_tabs:result.changedTabs,image_fallback_tabs:result.mediaFailures}));
    if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`changed=${result.changed}\n`);
  }catch(error){
    console.error(error instanceof SourceError?error.message:'產生網站失敗：'+error.message);
    process.exitCode=1;
  }
}
