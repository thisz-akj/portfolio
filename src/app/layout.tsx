import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { fontVariables } from "@/lib/fonts";
import { site } from "@/content/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — ${site.role}`, template: `%s — ${site.name}` },
  description: site.description,
  openGraph: { title: site.name, description: site.description, type: "website" },
};

export const viewport: Viewport = { themeColor: "#0a0a0a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        {children}
        {/* Cookieless page-view counts; only reports when deployed on Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}
