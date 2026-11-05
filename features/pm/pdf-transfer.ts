export function isAppleTouchDevice(device: Pick<Navigator,"userAgent"|"platform"|"maxTouchPoints">) {
  return /iPad|iPhone|iPod/.test(device.userAgent)||(device.platform==="MacIntel"&&device.maxTouchPoints>1);
}
export async function pdfFile(response: Response): Promise<File> {
  if(!response.ok){const result=await response.json();throw new Error(result.error||"Unable to download the PDF.");}
  if(!response.headers.get("content-type")?.includes("application/pdf"))throw new Error("The server did not return a PDF.");
  const proposed=response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]||"CryoPM-report.pdf";
  const name=proposed.replace(/[^a-zA-Z0-9_.-]/g,"-").slice(0,160).replace(/\.pdf$/i,"")+".pdf";
  return new File([await response.blob()],name,{type:"application/pdf"});
}
export function canSaveWithShare(file:File,device:Pick<Navigator,"canShare"|"share">) {
  return typeof device.share==="function"&&typeof device.canShare==="function"&&device.canShare({files:[file]});
}
// Called immediately by a fresh click, before any network/storage awaits.
export function sharePdf(file:File,device:Pick<Navigator,"share">) {return device.share({files:[file]});}
