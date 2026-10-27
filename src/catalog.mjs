// Fixed source identities. Raw source titles and history never follow display renames.
export const SITE_NAME = '伊樆 𐓷 椏樆椏 Iliavia';
export const DOCUMENT_ID = '13x6pnxR9hUFTuAVysBHGWa7fpOAoG6oL3NpMdANsOIA';
export const PRIMARY_TAB = 't.hcazkr7vzhp9';
export const ORIGINAL_TAB = 't.0';
export const TAB_PREFIXES={'t.hcazkr7vzhp9':'a9f11b4c2d1a','t.gbcaaxqgbkej':'274c4962f0f8','t.nzf45lbshn11':'9eb1c7c3398c','t.o8zb2xicyxoo':'921150af923e','t.sbkg53uir45x':'267403f1d495','t.cx5wy0vc5dmy':'e776ec95b996'};
export const TABS = [
  {id:PRIMARY_TAB,title:SITE_NAME+'筆記',expected:['Iliavia筆記']},
  {id:'t.gbcaaxqgbkej',title:'Iliavia各種測驗結果',expected:['Iliavia各種測驗結果']},
  {id:'t.nzf45lbshn11',title:'黑歷史',expected:['黑歷史']},
  {id:'t.o8zb2xicyxoo',title:'鼠兔各種值得紀念回',expected:['鼠兔各種值得紀念回']},
  {id:'t.sbkg53uir45x',title:'鼠兔各種梗圖',expected:['鼠兔各種梗圖']},
  {id:'t.cx5wy0vc5dmy',title:'鼠兔語錄',expected:['鼠兔爆言語錄','鼠兔語錄']},
];
export const [TESTS_TAB,HISTORY_TAB,STREAMS_TAB,MEMES_TAB,QUOTES_TAB] = TABS.slice(1).map(t=>t.id);
export const sourceUrl = (tab) => `https://docs.google.com/document/d/${DOCUMENT_ID}/edit?tab=${encodeURIComponent(tab)}`;
export const normalize = (s) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof s==='string'?new TextEncoder().encode(s):s))].map(x=>x.toString(16).padStart(2,'0')).join('');
export function safeLink(value) {
  try {
    if (typeof value!=='string' || value.length>4000 || /[\x00-\x20\x7f\\]/.test(value)) return null;
    let u=new URL(value);
    if (['google.com','www.google.com'].includes(u.hostname) && u.pathname==='/url') u=new URL(u.searchParams.get('q')||u.searchParams.get('url'));
    return ['https:','http:'].includes(u.protocol) && !u.username && !u.password && !/^[^/]+:\/\/[^/]*@/.test(u.href) && (!u.port||['80','443'].includes(u.port)) ? u.href : null;
  } catch {return null;}
}
