import { Library } from "@/features/demos/document-intelligence/ui/Library";

export default function DocDeskHome() {
  return (
    <main className="dd-content">
      <div className="dd-head">
        <h1>Document library</h1>
        <p>
          Open a document to ask questions with highlighted sources, pull out its fields, and see what the checks caught. Or upload your own
          one-page PDF.
        </p>
      </div>
      <Library />
    </main>
  );
}
