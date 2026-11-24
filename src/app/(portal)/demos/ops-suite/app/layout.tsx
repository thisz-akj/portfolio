import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPersona, listPersonas, type Persona } from "@/features/demos/ops-suite/auth/persona.server";
import { Sidebar } from "@/features/demos/ops-suite/ui/Sidebar";
import { PersonaProvider, PersonaSwitcher } from "@/features/demos/ops-suite/ui/Persona";
import "@/features/demos/ops-suite/ui/portal.css";
import "@/features/demos/ops-suite/ui/table/table.css";
import "@/features/demos/ops-suite/ui/record/record.css";
import "@/features/demos/ops-suite/ui/dashboard/dashboard.css";

export const metadata: Metadata = {
  title: "Ops Suite — CRM, ERP & data portal demo",
  robots: { index: false },
};

/** App-style frame: no site header/footer, custom cursor or smooth scroll (they fight with tables and inputs). */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  let persona: Persona = { id: 0, name: "Demo Admin", role: "admin" };
  let personas: Persona[] = [];
  try {
    [persona, personas] = await Promise.all([getPersona().then((p) => p ?? persona), listPersonas()]);
  } catch {
    /* database unavailable: pages show their own error state */
  }
  return (
    <PersonaProvider persona={persona}>
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
            <PersonaSwitcher personas={personas} />
          </header>
          <main className="ops-content">{children}</main>
        </div>
      </div>
    </PersonaProvider>
  );
}
