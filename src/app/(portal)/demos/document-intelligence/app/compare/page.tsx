import { Suspense } from "react";
import { Compare } from "@/features/demos/document-intelligence/ui/Compare";

export default function ComparePage() {
  return (
    <main className="dd-content">
      <div className="dd-head">
        <h1>Compare</h1>
        <p>See exactly what changed between two versions of a contract, or check an invoice line by line against its purchase order before you pay it.</p>
      </div>
      <Suspense fallback={<div className="dd-skel" style={{ height: "8rem" }} />}>
        <Compare />
      </Suspense>
    </main>
  );
}
