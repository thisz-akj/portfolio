import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Cursor } from "@/components/layout/Cursor";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { SoundProvider } from "@/components/layout/SoundProvider";
import "@/styles/hired.css";

/** The portfolio's page frame: header, footer, custom cursor, Lenis and sound. App-style routes (e.g. demo portals) skip it. */
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
    </>
  );
}
