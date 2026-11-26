import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Cursor } from "@/components/layout/Cursor";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { SoundProvider } from "@/components/layout/SoundProvider";
import { Assistant } from "@/components/assistant/Assistant";
import "@/styles/hired.css";
import "@/styles/assistant.css";

/** The portfolio's page frame: header, footer, custom cursor, Lenis, sound and the "Ask about Azad" assistant. App-style routes (e.g. demo portals) skip it. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SmoothScroll />
      <SoundProvider />
      <Cursor />
      <Header />
      <main id="main" className="page">
        {children}
      </main>
      <Footer />
      <Assistant />
    </>
  );
}
