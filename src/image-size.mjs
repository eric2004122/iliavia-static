// 從原圖檔頭讀出寬高，讓網頁先預留位置、載入時版面不跳動。只讀不改，讀不出來就回傳 null。
export function imageSize(bytes){
  const u16=(i,little)=>little?bytes[i]|bytes[i+1]<<8:bytes[i]<<8|bytes[i+1];
  const u24=i=>bytes[i]|bytes[i+1]<<8|bytes[i+2]<<16;
  const u32=i=>(bytes[i]<<24|bytes[i+1]<<16|bytes[i+2]<<8|bytes[i+3])>>>0;
  const ascii=(start,end)=>String.fromCharCode(...bytes.slice(start,end));
  if(bytes.length>=24&&bytes[0]===137&&ascii(12,16)==='IHDR')return [u32(16),u32(20)];
  if(bytes.length>=10&&ascii(0,3)==='GIF')return [u16(6,true),u16(8,true)];
  if(bytes.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'){
    const chunk=ascii(12,16);
    if(chunk==='VP8X')return [u24(24)+1,u24(27)+1];
    if(chunk==='VP8L'){const b=bytes.slice(21,25);return [1+((b[1]&0x3f)<<8|b[0]),1+((b[3]&0xf)<<10|b[2]<<2|(b[1]&0xc0)>>6)];}
    if(chunk==='VP8 ')return [u16(26,true)&0x3fff,u16(28,true)&0x3fff];
  }
  if(bytes[0]===0xff&&bytes[1]===0xd8){
    // JPEG：找 SOF 區段（C0–CF，但 C4、C8、CC 不是）
    for(let i=2;i+9<bytes.length;){
      if(bytes[i]!==0xff){i++;continue;}
      const marker=bytes[i+1];
      if(marker===0xd8||marker===0x01||(marker>=0xd0&&marker<=0xd7)){i+=2;continue;}
      if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker))return [u16(i+7),u16(i+5)];
      i+=2+u16(i+2);
    }
  }
  return null;
}
