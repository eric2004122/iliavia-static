// 靜態網站建置測試：用假的 Google 匯出（合成資料），全部寫在暫存資料夾，不連網、不碰 .state/ 與 dist/。
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,existsSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Parser} from 'htmlparser2';
import {build} from '../build.mjs';
import {TABS,PRIMARY_TAB,HISTORY_TAB,MEMES_TAB} from '../src/catalog.mjs';
import {SourceError,allowedRedirect} from '../src/source.mjs';
import {buildProfile,splitList,sensitiveKind} from '../src/profile.mjs';
import {imageSize} from '../src/image-size.mjs';
import {presentation} from '../src/presentation.mjs';
const presentationFor=(body,tab=PRIMARY_TAB)=>presentation(body,tab,TABS.find(t=>t.id===tab).title);
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');

// 1×1 PNG（合成）
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const BODIES={
  [PRIMARY_TAB]:'♡₍ᐢ.ˬ.ᐢ₎♡Iliavia筆記♡₍ᐢ.ˬ.ᐢ₎♡\n♡📌基本資料♡₍ᐢ.ˬ.ᐢ₎\n\t♡姓名 / 別稱\n\t測試甲、測試乙（含、頓號）、測試丙\n\t♡出道日期\n\t2000年1月1日（測試說明）\n\t♡性格\n\t測試性格一、測試性格二\n\t♡性癖\n\t測試用十八禁內容\n\t♡口頭禪\n\t「測試一」、「測試二」\n',
  [HISTORY_TAB]:'黑歷史\n\t1\n\t第一件測試事\n\t2\n\t測試里程碑\n\t3\n\t\n',
};
const bodyFor=tab=>BODIES[tab.id]||tab.expected[0]+'\n測試來源全文 '+tab.id+'\n';
const htmlFor=(text,images)=>`<html><body>${text.split('\n').map(line=>`<p>${line.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</p>`).join('')}${images.map(()=>`<img src="data:image/png;base64,${PNG}">`).join('')}</body></html>`;
// mode：'ok' 全部正常；'no-html' 圖片匯出全部失敗；'no-txt' 原文匯出失敗
function fakeGoogle({mode='ok',bodies={},calls={txt:0,html:0}}={}){
  const fetcher=async url=>{
    const u=new URL(url),tab=TABS.find(t=>t.id===u.searchParams.get('tab')),body=bodies[tab.id]??bodyFor(tab);
    if(u.searchParams.get('format')==='txt'){calls.txt++;if(mode==='no-txt')return new Response('',{status:500});return new Response(body,{headers:{'content-type':'text/plain; charset=utf-8'}});}
    calls.html++;if(mode==='no-html')throw new TypeError('synthetic network failure');
    return new Response(htmlFor(body,[PRIMARY_TAB,MEMES_TAB].includes(tab.id)?[1]:[]),{headers:{'content-type':'text/html; charset=utf-8'}});
  };
  return {fetcher,calls};
}
function workspace(){const dir=mkdtempSync(join(tmpdir(),'iliavia-static-'));return {dir,stateDir:join(dir,'state'),outDir:join(dir,'dist'),cleanup:()=>rmSync(dir,{recursive:true,force:true})};}
const run=(w,options={})=>build({root:ROOT,stateDir:w.stateDir,outDir:w.outDir,env:{},log:()=>{},...options});
const read=(w,path)=>readFileSync(join(w.outDir,path),'utf8');
// 所有 data-source-block 裡的文字接起來，必須和原文一字不差
function sourceText(html){let depth=0,inside=[],text='';const parser=new Parser({onopentag(name,attrs){depth++;if(Object.hasOwn(attrs,'data-source-block'))inside.push(depth);},ontext(t){if(inside.length)text+=t;},onclosetag(){if(inside.at(-1)===depth)inside.pop();depth--;}},{decodeEntities:true});parser.write(html);parser.end();return text;}

test('builds every page, keeps source text exactly and copies original images',async()=>{
  const w=workspace();try{
    const result=await run(w,{fetcher:fakeGoogle().fetcher});assert.equal(result.changed,true);assert.equal(result.tabs,6);
    for(const page of ['index.html','profile/index.html','document/index.html','document/changes/index.html','settings/index.html','about/index.html','404.html','robots.txt','data/state.json','data/search.json','data/quotes.json','data/picks.json','static/reader-search.js'])assert.ok(existsSync(join(w.outDir,page)),page);
    for(const tab of TABS)assert.equal(sourceText(read(w,`document/${tab.id}/index.html`)),bodyFor(tab),tab.id);
    assert.equal(readdirSync(join(w.outDir,'images')).length,1);
    const primary=read(w,`document/${PRIMARY_TAB}/index.html`);
    assert.ok(primary.includes('<details class="reader-sensitive" data-sensitive><summary data-kind="18+"'));assert.ok(primary.includes('src="/images/'));assert.ok(primary.indexOf('reader-search.js')<primary.indexOf('/static/reader.js'));
    // 圖片先標好寬高、有編號角標；介紹頁開頭有立繪與分區跳轉
    assert.match(primary,/<img src="\/images\/[a-f0-9]{64}\.png" alt="[^"]+" width="1" height="1"/);assert.ok(primary.includes('class="reader-image-no"'));
    const profilePage=read(w,'profile/index.html');assert.ok(profilePage.includes('class="profile-portrait"'));assert.ok(profilePage.includes('<nav class="profile-jump" aria-label="介紹分區"><a href="#profile-stats-title">資料</a>'));
    assert.ok(read(w,`document/${HISTORY_TAB}/index.html`).includes('<span class="reader-event-no">\t1</span><span class="reader-event-text">\n\t第一件測試事\n</span>'));
    assert.ok(read(w,'document/index.html').includes('data-document-index'));
    const home=read(w,'index.html');for(const part of ['快速認識','home-tab-count','最近更新','data-home-pick','href="/profile/"'])assert.ok(home.includes(part),part);
    const nav=home.slice(home.indexOf('class="main-nav"'));assert.ok(nav.indexOf('>介紹<')<nav.indexOf('>共編筆記<'));assert.ok(!home.includes('/admin'));
    assert.ok(read(w,'profile/index.html').includes('測試乙（含、頓號）'));
    assert.deepEqual(JSON.parse(read(w,'data/quotes.json')),['測試一','測試二']);
    const search=JSON.parse(read(w,'data/search.json'));assert.equal(search.tabs.length,6);assert.ok(!search.tabs.find(t=>t.id===HISTORY_TAB).text.endsWith('3\n\t\n'));
  }finally{w.cleanup();}
});
test('pages carry their own security policy and stay out of search engines unless SEARCH_INDEXING is exactly 1',async()=>{
  const w=workspace();try{
    await run(w,{fetcher:fakeGoogle().fetcher});
    for(const page of ['index.html','profile/index.html',`document/${PRIMARY_TAB}/index.html`,'404.html'])assert.ok(read(w,page).includes(`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self';`),page);
    assert.equal(read(w,'robots.txt'),'User-agent: *\nDisallow: /\n');assert.ok(read(w,'index.html').includes('<meta name="robots" content="noindex'));
    await run(w,{offline:true,env:{SEARCH_INDEXING:'1',SITE_URL:'https://example.github.io/iliavia-static',BASE_PATH:'/iliavia-static'}});
    assert.ok(!read(w,'index.html').includes('name="robots"'));
    assert.match(read(w,'robots.txt'),/Sitemap: https:\/\/example\.github\.io\/iliavia-static\/sitemap\.xml/);assert.ok(read(w,'sitemap.xml').includes('https://example.github.io/iliavia-static/document/'+PRIMARY_TAB+'/'));
  }finally{w.cleanup();}
});
test('GitHub Pages project path prefixes every site link but leaves external links and source text alone',async()=>{
  const w=workspace();try{
    await run(w,{fetcher:fakeGoogle().fetcher,env:{BASE_PATH:'/iliavia-static'}});
    for(const page of ['index.html','profile/index.html','document/index.html',`document/${HISTORY_TAB}/index.html`,'document/changes/index.html','settings/index.html','about/index.html','404.html']){
      const html=read(w,page);
      assert.deepEqual(html.match(/\s(?:href|src|action|data-[a-z-]+-url)="\/(?!iliavia-static\/)[^"]*"/g),null,page);
      assert.ok(html.includes('href="/iliavia-static/static/site.css"'),page);
    }
    const reader=read(w,`document/${PRIMARY_TAB}/index.html`);
    for(const part of ['data-document-state-url="/iliavia-static/data/state.json"','data-search-url="/iliavia-static/data/search.json"','data-images-url="/iliavia-static/images/"','src="/iliavia-static/images/','href="https://www.youtube.com/@Iliaviasocute"'])assert.ok(reader.includes(part),part);
    assert.equal(sourceText(reader),BODIES[PRIMARY_TAB]);
    assert.ok(read(w,'index.html').includes('data-picks-url="/iliavia-static/data/picks.json"'));
    assert.ok(JSON.parse(read(w,'data/search.json')).tabs.every(t=>t.path.startsWith('/iliavia-static/document/')));
    assert.ok(JSON.parse(read(w,'data/picks.json')).filter(p=>p.kind==='meme').every(p=>p.url.startsWith('/iliavia-static/images/')));
    await assert.rejects(run(w,{offline:true,env:{BASE_PATH:'/../evil'}}),/BASE_PATH/);
  }finally{w.cleanup();}
});
test('unchanged source is reported as unchanged and records no new revision',async()=>{
  const w=workspace();try{
    await run(w,{fetcher:fakeGoogle().fetcher});const second=await run(w,{fetcher:fakeGoogle().fetcher});
    assert.equal(second.changed,false);assert.equal(JSON.parse(readFileSync(join(w.stateDir,'state.json'),'utf8')).revisions.length,6);
    const third=await run(w,{fetcher:fakeGoogle({bodies:{[PRIMARY_TAB]:BODIES[PRIMARY_TAB].replace('測試性格一','新的測試性格')}}).fetcher});
    assert.equal(third.changed,true);assert.deepEqual(third.changedTabs,[PRIMARY_TAB]);
    assert.ok(read(w,'index.html').includes('新增 1 段、移除 1 段'));assert.ok(read(w,'document/changes/index.html').includes('新的測試性格'));
  }finally{w.cleanup();}
});
test('image export failure retries once, still updates text and keeps the previous images',async()=>{
  const w=workspace();try{
    await run(w,{fetcher:fakeGoogle().fetcher});
    const google=fakeGoogle({mode:'no-html',bodies:{[PRIMARY_TAB]:BODIES[PRIMARY_TAB].replace('測試性格一','圖片失敗時的測試性格')}});
    const result=await run(w,{fetcher:google.fetcher});
    assert.deepEqual(google.calls,{txt:6,html:12});assert.equal(result.mediaFailures.length,6);
    const page=read(w,`document/${PRIMARY_TAB}/index.html`);assert.ok(page.includes('圖片失敗時的測試性格'));assert.ok(page.includes('src="/images/'));
    assert.equal(readdirSync(join(w.outDir,'images')).length,1);
  }finally{w.cleanup();}
});
test('source text failure throws and leaves the previous state untouched',async()=>{
  const w=workspace();try{
    await run(w,{fetcher:fakeGoogle().fetcher});const before=readFileSync(join(w.stateDir,'state.json'),'utf8');
    await assert.rejects(run(w,{fetcher:fakeGoogle({mode:'no-txt'}).fetcher}),SourceError);
    assert.equal(readFileSync(join(w.stateDir,'state.json'),'utf8'),before);
    const empty=workspace();try{await assert.rejects(run(empty,{offline:true}));}finally{empty.cleanup();}
  }finally{w.cleanup();}
});
test('only fixed Google export URLs are followed',()=>{
  const good='https://doc-14-4o-docstext.googleusercontent.com/export/opaque?format=txt&tab='+PRIMARY_TAB;assert.equal(allowedRedirect(new URL(good),PRIMARY_TAB,'txt'),true);
  for(const bad of [good.replace('.com/','.com.evil.test/'),good.replace(PRIMARY_TAB,'t.0'),good.replace('https:','http:')])assert.equal(allowedRedirect(new URL(bad),PRIMARY_TAB,'txt'),false);
});
test('image sizes are read from PNG, GIF, JPEG and WebP headers without changing the bytes',()=>{
  const bytes=s=>Uint8Array.from(Buffer.from(s,'base64'));
  assert.deepEqual(imageSize(bytes(PNG)),[1,1]);
  assert.deepEqual(imageSize(Uint8Array.from([71,73,70,56,57,97,3,0,2,0,0,0,0,59])),[3,2]);
  const jpeg=Uint8Array.from([0xff,0xd8,0xff,0xe0,0,4,0,0,0xff,0xc0,0,11,8,0,5,0,7,1,1,0x11,0,0xff,0xd9]);assert.deepEqual(imageSize(jpeg),[7,5]);
  const webp=new Uint8Array(30);webp.set([...Buffer.from('RIFF')],0);webp.set([...Buffer.from('WEBPVP8X')],8);webp.set([9,0,0,4,0,0],24);assert.deepEqual(imageSize(webp),[10,5]);
  assert.equal(imageSize(Uint8Array.from([1,2,3])),null);
});
test('decorated section titles start new sections; bracketed values and numbered lines with colons stay inside their card',()=>{
  const body='♡₍ᐢ.ˬ.ᐢ₎♡Iliavia筆記♡₍ᐢ.ˬ.ᐢ₎♡\n♡🏆 榮譽榜♡₍ᐢ.ˬ.ᐢ₎\n♡ 事蹟列表\n\t1. 測試冠軍\n2. 很大聲地說：「測試」\n\t\n♡⚖️開庭紀錄♡₍ᐢ.ˬ.ᐢ₎\n♡ 潛在原告\n\t【等待測試填寫】\n\t♡🗣️ 口頭禪紀錄♡₍ᐢ.ˬ.ᐢ₎\n♡ 口頭禪\n\t「測試」\n';
  const p=presentationFor(body),blocks=p.sections.flatMap(s=>s.blocks);
  assert.equal(blocks.map(b=>b.raw).join(''),body);
  assert.deepEqual(blocks.filter(b=>b.kind==='heading').map(b=>b.raw.trim()),['♡₍ᐢ.ˬ.ᐢ₎♡Iliavia筆記♡₍ᐢ.ˬ.ᐢ₎♡','♡🏆 榮譽榜♡₍ᐢ.ˬ.ᐢ₎','♡⚖️開庭紀錄♡₍ᐢ.ˬ.ᐢ₎','♡🗣️ 口頭禪紀錄♡₍ᐢ.ˬ.ᐢ₎']);
  const fields=blocks.filter(b=>b.kind==='field');assert.deepEqual(fields.map(b=>b.label),['♡ 事蹟列表','♡ 潛在原告','♡ 口頭禪']);
  assert.ok(fields[0].raw.includes('很大聲地說：「測試」'));assert.ok(fields[1].raw.includes('【等待測試填寫】'));assert.ok(!fields[1].raw.includes('口頭禪紀錄'));
  // 原文件的段落標題已經說明是哪一段，網站的分組名稱不再重複，也不進目錄
  assert.ok(p.sections.filter(s=>s.kind==='fields').every(s=>s.show_title===false));assert.ok(p.toc.every(t=>t.title.includes('₍ᐢ')));
  // 一般內容裡的【影片標題】【#標籤】不是標題
  assert.ok(presentationFor('鼠兔語錄\n測試\n\t【測試直播#3】測試【#Iliavia】\n','t.cx5wy0vc5dmy').sections.flatMap(s=>s.blocks).every(b=>b.kind!=='heading'||b.raw.startsWith('鼠兔語錄')));
});
test('profile cards split lists outside brackets and know which fields are sensitive',()=>{
  assert.deepEqual(splitList('甲、乙（含、頓號）、丙'),['甲','乙（含、頓號）','丙']);
  assert.deepEqual(buildProfile([{tab_id:PRIMARY_TAB,body:BODIES[PRIMARY_TAB],attachments:[],links:[]}]).profile.aliases,['測試甲','測試乙（含、頓號）','測試丙']);
  assert.equal(sensitiveKind('♡性癖'),'18+');assert.equal(sensitiveKind('♡興趣'),null);
});
