import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Sidebar } from "@/features/demos/ops-suite/ui/Sidebar";
import "@/features/demos/ops-suite/ui/portal.css";
import "@/features/demos/ops-suite/ui/table/table.css";
import "@/features/demos/ops-suite/ui/record/record.css";
import "@/features/demos/ops-suite/ui/dashboard/dashboard.css";

export const metadata: Metadata = {
  title: "Ops Suite — CRM, ERP & data portal demo",
  robots: { index: false },
};

/** App-style frame: no site header/footer, custom cursor or smooth scroll (they fight with tables and inputs). */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ops">
      <aside className="ops-side">
        <Link href="/demos/ops-suite/app" className="ops-brand">
          <span className="ops-brand-dot" aria-hidden="true" />
          Ops Suite
        </Link>
        <Sidebar />
        <Link href="/demos" className="ops-back">
          <ArrowLeft size={14} /> Back to portfolio
        </Link>
      </aside>
      <div className="ops-main">
        <header className="ops-top">
          <span className="ops-badge">Synthetic data · resets daily</span>
          <span className="ops-persona" title="Role switcher arrives in phase 6">
            Demo Admin <em>admin</em>
          </span>
        </header>
        <main className="ops-content">{children}</main>
      </div>
    </div>
  );
}
