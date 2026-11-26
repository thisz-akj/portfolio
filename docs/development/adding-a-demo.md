# Adding a demo

1. **Register the metadata** in `src/content/demos.ts`. Set `status: "coming-soon"` at first.
2. **Create the feature folder** `src/features/demos/<slug>/`:
   - `Demo.tsx`: client UI. It must include sample inputs, plus loading, empty, error and reset states.
   - `api.ts`: typed client for its endpoint.
   - `*.test.ts`: tests for its logic.
3. **Add a server endpoint** at `src/app/api/demos/<slug>/route.ts` (or an external service). Validate input, limit size and rate, set a timeout on provider calls, and never send keys to the browser.
4. **Register the UI** in `src/features/demos/registry.ts` with `"<slug>": Demo`.
5. Change the status to `limited-preview` and then to `live` **only once real model execution works**. `tests/content.test.ts` fails if a demo is marked live without a registered component.
6. Write `docs/demos/<slug>.md` covering behaviour, inputs, architecture and limitations.

The demo page template (`src/app/demos/[slug]/page.tsx`) renders the 9-part structure automatically. Public pages never show system architecture (owner rule) — keep it in `docs/` only.
