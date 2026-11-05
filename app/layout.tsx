import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "./globals.css";
import "./workspace.css";
import "@/features/accounts/accounts.css";
import "@/features/pm/analytics/overview.css";
import "./glass.css";
import "@/features/equipment/equipment.css";
import "./field-qa.css";
import "./auth.css";
import "@/features/offline/offline.css";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#081d30",
};


export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN || "http://localhost:3000"),
  title: "CryoPM · Cryogenics Solution Inc.",
  description: "Preventive maintenance records for cryogenic equipment.",
  icons: { icon: [{url:"/brand/cryogenics-app-192.png",type:"image/png",sizes:"192x192"}], apple:[{url:"/brand/cryogenics-app-180.png",type:"image/png",sizes:"180x180"}] },
  appleWebApp:{capable:true,title:"CryoPM",statusBarStyle:"black-translucent"},
  openGraph: {
    title: "CryoPM",
    description: "Preventive Maintenance, Precisely Controlled",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "CryoPM preventive maintenance application" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CryoPM",
    description: "Preventive Maintenance, Precisely Controlled",
    images: ["/og.png"],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body >{children}</body>
    </html>
  );
}
