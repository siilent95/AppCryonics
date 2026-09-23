import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { requireChatGPTUser } from "./chatgpt-auth";
import "./globals.css";

export const dynamic = "force-dynamic";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
  await requireChatGPTUser("/");
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
