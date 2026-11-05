// Use the approved client logo's white monogram; never redraw the brand.
import sharp from "sharp";
import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
for(const size of [180,192,512]) {
  const glyph=await sharp(root+"public/brand/logo-light.png").extract({left:0,top:0,width:776,height:782}).resize(Math.round(size*.68),Math.round(size*.68),{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  await sharp({create:{width:size,height:size,channels:3,background:"#081d30"}}).composite([{input:glyph,gravity:"centre"}]).png().toFile(root+`public/brand/cryogenics-app-${size}.png`);
}

// Standard Safari fallback for installations that do not read the metadata link.
await copyFile(root+"public/brand/cryogenics-app-180.png",root+"public/apple-touch-icon.png");
