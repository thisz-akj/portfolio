import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <section className="inner" style={{ minHeight: "80vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <p className="eyebrow">404</p>
      <h1 className="inner-title">This page hallucinated.</h1>
      <p className="lede" style={{ marginBottom: "2rem" }}>It looked confident, but it doesn&apos;t exist.</p>
      <div>
        <Link href="/" className="btn-pill">
          <ArrowLeft size={16} /> Back to ground truth
        </Link>
      </div>
    </section>
  );
}
