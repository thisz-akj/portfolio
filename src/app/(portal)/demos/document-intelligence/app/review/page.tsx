import { Review } from "@/features/demos/document-intelligence/ui/Review";

export default function ReviewPage() {
  return (
    <main className="dd-content">
      <div className="dd-head">
        <h1>Review queue</h1>
        <p>Everything a person should look at: failed checks, risky terms and extracted values the document didn&apos;t confirm. The rest flows through untouched.</p>
      </div>
      <Review />
    </main>
  );
}
