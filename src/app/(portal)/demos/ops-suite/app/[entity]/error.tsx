"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="ops-card" role="alert">
      <p>
        <span className="ops-dot is-down" aria-hidden="true" /> Something went wrong loading this list.
      </p>
      <button type="button" className="ops-btn" style={{ marginTop: "0.8rem" }} onClick={reset}>
        Try again
      </button>
    </section>
  );
}
