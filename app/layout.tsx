import type { Metadata } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: "CryoPM · Cryogenics Solution Inc.",
  description: "Preventive maintenance records for cryogenic equipment.",
  icons: { icon: "/brand/icon.png" },
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
