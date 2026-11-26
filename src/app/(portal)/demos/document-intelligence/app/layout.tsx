import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Sidebar } from "@/features/demos/document-intelligence/ui/Sidebar";
import { DOCDESK_BASE } from "@/features/demos/document-intelligence/nav";
import "@/features/demos/document-intelligence/ui/docdesk.css";
import { HomeLink } from "@/components/shared/HomeLink";

export const metadata: Metadata = {
  title: "DocDesk — document intelligence demo",
  robots: { index: false },
};

/** App-style frame: no site header/footer, custom cursor or smooth scroll (they fight with scrolling panes). */
export default function DocDeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dd">
      <aside className="dd-side">
        <Link href={DOCDESK_BASE} className="dd-brand">
          <span className="dd-brand-mark" aria-hidden="true" />
          DocDesk
        </Link>
        <Sidebar />
        <div className="app-exits">
          <HomeLink />
          <Link href="/demos/document-intelligence" className="dd-back">
            <ArrowLeft size={14} /> About DocDesk
          </Link>
        </div>
      </aside>
      <div className="dd-main">
        <header className="dd-top">
          <span className="dd-badge">Sample documents are synthetic · uploads deleted after 60 min</span>
        </header>
        {children}
      </div>
    </div>
  );
}
