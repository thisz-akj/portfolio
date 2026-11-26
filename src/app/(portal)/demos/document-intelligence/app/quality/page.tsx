import { Quality } from "@/features/demos/document-intelligence/ui/Quality";

export default function QualityPage() {
  return (
    <main className="dd-content">
      <div className="dd-head">
        <h1>Quality</h1>
        <p>Measured, not claimed: how often DocDesk answers correctly, cites the right clause, admits when a document doesn&apos;t say, and extracts fields right.</p>
      </div>
      <Quality />
    </main>
  );
}
