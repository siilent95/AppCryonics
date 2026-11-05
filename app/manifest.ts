import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest {
  return {id:"/",name:"CryoPM · Field maintenance",short_name:"CryoPM",start_url:"/",scope:"/",display:"standalone",background_color:"#081d30",theme_color:"#081d30",icons:[{src:"/brand/pwa-192.png",sizes:"192x192",type:"image/png",purpose:"any"},{src:"/brand/pwa-512.png",sizes:"512x512",type:"image/png",purpose:"any"}]};
}
