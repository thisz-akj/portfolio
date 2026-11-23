# AI Engineering Portfolio & Interactive Solutions Showcase

## Project brief for Claude Code

**Owner:** Azad Kumar Jha\
**Positioning:** Independent Applied AI Engineer\
**Primary audience:** Startup founders, CTOs, product teams and
potential clients\
**Primary goal:** Let visitors understand the AI solutions I can build,
try interactive demonstrations, inspect the engineering behind them, and
contact me about a project.

------------------------------------------------------------------------

# 1. What this website should be

Build a professional personal engineering website that combines:

1.  **Personal portfolio** --- who I am, my experience, technical
    capabilities and selected work.
2.  **AI solutions showcase** --- a collection of AI application
    categories I can build for businesses.
3.  **Interactive product demos** --- visitors should be able to try
    working examples, not just view screenshots.
4.  **Technical case studies** --- explain how each demo works, its
    architecture, technologies, evaluation and limitations.
5.  **Lead generation** --- make it easy for a founder or company to
    contact me about a paid project or collaboration.

This should not look or behave like a generic résumé website or an AI
agency template. It should communicate that I am an engineer who can
build, integrate, evaluate and improve practical AI products.

I will provide the visual design, fonts, branding, preferred technology
stack, providers, deployment choices and other implementation-specific
technical decisions separately. **Do not make detailed design-system or
technology choices on my behalf.** Keep the implementation modular so
these choices can be applied later.

------------------------------------------------------------------------

# 2. Main website sections

## Home

The homepage should quickly communicate: - Who I am. - What kinds of AI
systems I build. - The business problems I can help solve. - Featured
interactive demos. - Selected engineering projects. - How to contact me.

Include clear links to the demos, work and contact pages.

## AI Solutions

A page presenting the seven solution categories listed in Section 3.
Each category should explain the problem it solves, typical capabilities
and potential business customers. Each should link to a relevant demo
when one exists.

## Demos

A central catalogue of interactive demonstrations. Each demo should
have: - Name and short description. - Business problem. - Capabilities
visitors can try. - Demo status: Live, Limited Preview or Coming Soon. -
Link to its dedicated page.

Only mark a demo as Live when it genuinely works.

## Individual demo pages

Every demo should have its own route and a consistent information
structure: 1. Overview and business problem. 2. Interactive demo. 3.
Example input or sample data. 4. Output and explanation. 5. How it
works. 6. Architecture / data-flow explanation. 7. Technologies and
components. 8. Evaluation or performance results, when measured. 9.
Limitations and possible business applications. 10. Contact CTA.

Keep the interactive experience prominent. The visitor should be able to
understand and try the product without reading a long article first.

## Work / Case Studies

A place to present selected engineering projects and case studies. Use
only factual, approved information. Each project should describe the
problem, my contribution, approach, implementation, results and lessons
learned.

## About

Professional introduction, experience, technical focus, working approach
and links to professional profiles.

## Contact

A simple way for founders and teams to contact me about an AI project,
product feature or part-time engineering collaboration.

------------------------------------------------------------------------

# 3. AI solutions to showcase

These are the seven business solution categories the website must
present. They are not necessarily seven separate demos in the first
release. Build the website so each category can later have one or more
working demos and case studies.

## 1. Document Intelligence

Extract information from PDFs, contracts, invoices, reports and other
documents.

Capabilities: - Ask questions across one or multiple documents. -
Extract fields into structured JSON. - Summarize long documents. -
Compare documents and identify inconsistencies.

Potential customers: Legal-tech, finance, insurance, HR and enterprise
SaaS.

## 2. AI Customer Support

Automate customer conversations and support workflows.

Capabilities: - Answer questions using company knowledge. - Classify
incoming support tickets. - Draft responses for support agents. -
Escalate complicated cases to human agents.

Potential customers: E-commerce, SaaS, travel and service companies.

## 3. AI Workflow Automation

Automate repetitive business operations using AI and integrations.

Capabilities: - Read incoming emails and create tasks. - Process forms
and update CRM records. - Generate reports automatically. - Connect
internal tools through AI-driven workflows.

Potential customers: Startups, sales teams, operations and service
businesses.

## 4. AI Evaluation and Monitoring

Help companies understand whether their AI products are working
reliably.

Capabilities: - Compare different LLMs. - Evaluate RAG answer
accuracy. - Detect hallucinations and incorrect responses. - Track
latency, token usage and cost. - Monitor model performance over time.

Potential customers: AI startups building LLM-based products.

## 5. Computer Vision and Visual AI

Use images and videos to automate visual inspection and understanding.

Capabilities: - Defect detection in manufacturing. - Object detection
and tracking. - PPE and safety compliance monitoring. - Image
classification and visual search. - Video understanding and
summarization.

Potential customers: Manufacturing, robotics, logistics and retail.

## 6. AI Data Analytics

Help businesses understand their data using natural language and machine
learning.

Capabilities: - Ask questions about business data. - Generate reports
and visualizations. - Forecast sales and demand. - Identify unusual
patterns. - Predict customer churn.

Potential customers: SaaS, retail, finance and operations teams.

## 7. Voice AI and Conversational Agents

Build AI systems that communicate through voice.

Capabilities: - Automated appointment booking. - Inbound customer
support. - Lead qualification. - Call transcription and summarization. -
Multilingual voice assistants.

Potential customers: Healthcare administration, real estate, sales and
customer service.

------------------------------------------------------------------------

# 4. Interactive demo strategy

The site should support multiple independent demos over time. Do not try
to implement all seven categories as fully working products at once.

Suggested implementation order:

1.  **Document Intelligence** --- first flagship demo. Let a visitor use
    a sample PDF, ask questions, see answers and inspect supporting
    source passages.
2.  **AI Evaluation and Monitoring** --- compare model or prompt
    configurations against a fixed dataset and inspect quality, latency,
    cost and failure cases.
3.  **Computer Vision and Visual AI** --- upload or select a sample
    image, run a real model and inspect annotated results.
4.  **AI Customer Support** --- demonstrate a support assistant that
    uses a sample knowledge base, classifies requests and drafts
    responses.
5.  **AI Workflow Automation** --- run a restricted sample workflow and
    show the steps, tool calls and final output.
6.  **AI Data Analytics** --- ask questions about a sample dataset and
    display the resulting analysis or visualization.
7.  **Voice AI** --- demonstrate a controlled voice interaction,
    transcription or call-summary workflow.

The order can change if implementation dependencies or the owner's
priorities change.

For every public demo: - Provide sample inputs so visitors can try it
immediately. - Clearly explain supported inputs and limits. - Validate
user input and uploads. - Include loading, empty, success and error
states. - Add a reset option. - Do not expose API keys in the browser. -
Apply request limits and cost controls. - Do not retain uploaded data
longer than necessary. - Do not allow anonymous users to execute
arbitrary code, shell commands or unrestricted external actions. -
Clearly disclose that AI outputs may be incorrect. - Use real model
execution for anything labelled as a working demo. Label prototypes and
mockups honestly.

------------------------------------------------------------------------

# 5. Scalable folder structure

Use the following as the intended logical structure. Adapt names and
files to the technology stack I provide. Do not force a framework,
monorepo tool or unnecessary service architecture before those decisions
are confirmed.

``` text
ai-engineering-showcase/
│
├── apps/
│   ├── web/                             # Main portfolio and demo website
│   │   ├── public/                      # Static assets
│   │   └── src/
│   │       ├── app/                     # Routes / pages
│   │       │   ├── home/
│   │       │   ├── solutions/
│   │       │   ├── demos/
│   │       │   ├── work/
│   │       │   ├── about/
│   │       │   └── contact/
│   │       │
│   │       ├── components/
│   │       │   ├── layout/              # Header, footer, navigation
│   │       │   ├── shared/              # Reusable site components
│   │       │   ├── demos/               # Shared demo components
│   │       │   └── ui/                  # Reusable UI primitives
│   │       │
│   │       ├── features/
│   │       │   └── demos/
│   │       │       ├── document-intelligence/
│   │       │       ├── customer-support/
│   │       │       ├── workflow-automation/
│   │       │       ├── ai-evaluation/
│   │       │       ├── computer-vision/
│   │       │       ├── data-analytics/
│   │       │       └── voice-ai/
│   │       │
│   │       ├── content/
│   │       │   ├── solutions/
│   │       │   ├── projects/
│   │       │   └── demos/
│   │       │
│   │       ├── lib/                     # Shared application utilities
│   │       ├── hooks/
│   │       ├── types/
│   │       └── styles/
│   │
│   └── api/                             # Backend for AI demos, if selected
│       ├── app/
│       │   ├── api/                     # API routes / controllers
│       │   ├── core/                    # Configuration, security, logging
│       │   ├── schemas/                 # Request and response schemas
│       │   ├── services/
│       │   │   ├── providers/           # LLM / model provider adapters
│       │   │   ├── document_intelligence/
│       │   │   ├── customer_support/
│       │   │   ├── workflow_automation/
│       │   │   ├── evaluation/
│       │   │   ├── computer_vision/
│       │   │   ├── data_analytics/
│       │   │   └── voice_ai/
│       │   ├── repositories/            # Data access layer
│       │   └── utils/
│       └── tests/
│
├── packages/                            # Shared packages, only if needed
├── docs/
│   ├── architecture/
│   ├── demos/
│   ├── development/
│   ├── deployment/
│   └── decisions/
│
├── infra/                                # Deployment / infrastructure config
├── scripts/
├── tests/
├── .github/                              # CI workflows
├── .env.example
├── .gitignore
└── README.md
```

### Folder structure rules

-   Keep each demo isolated in its own feature/module.
-   Keep shared components separate from demo-specific components.
-   Keep page/route files small; put application logic in feature
    modules or services.
-   Keep content and metadata separate from presentation.
-   Keep provider-specific integrations behind adapters/interfaces so
    providers can be replaced.
-   Keep API request and response schemas explicit.
-   Add tests alongside or within the relevant application/service
    structure.
-   Do not create empty folders and placeholder services just to fill
    the structure.
-   Do not split everything into microservices at the start. Start with
    a modular application and separate services only when there is a
    real deployment or scaling reason.
-   If the selected stack does not need separate `web` and `api`
    applications initially, preserve clear frontend/backend boundaries
    without forcing a monorepo.

------------------------------------------------------------------------

# 6. Technical and operational requirements

I will provide the exact stack and provider choices. Once provided,
implement them consistently and document the decisions.

Regardless of stack, follow these principles:

## Application architecture

-   Separate presentation, business logic, integrations and data access.
-   Use typed and validated interfaces.
-   Keep demo implementations independent.
-   Use reusable API clients and consistent error handling.
-   Keep configuration environment-based.
-   Make it straightforward to add another demo without rewriting
    existing pages.

## Security

-   Never commit secrets or credentials.
-   Never expose private API keys in frontend code.
-   Validate all inputs on the server.
-   Restrict upload types and sizes.
-   Apply rate limits and usage quotas to expensive endpoints.
-   Restrict tools available to public agent demos.
-   Avoid logging private document contents or sensitive user data.
-   Use HTTPS in production.
-   Add appropriate security headers and CORS restrictions.

## Reliability

-   Provide meaningful loading, error and empty states.
-   Use timeouts and safe failure behavior for external providers.
-   Avoid unhandled exceptions.
-   Log useful operational metadata without logging secrets or private
    content.
-   Add tests for important workflows.
-   Document known limitations.

## Quality

-   Use formatting and linting tools appropriate to the selected stack.
-   Run static type checks.
-   Add unit tests for business logic.
-   Add integration tests for API and model workflows where practical.
-   Add end-to-end tests for critical visitor journeys.
-   Keep dependencies and configuration documented.

## SEO and accessibility

-   Use semantic page structure.
-   Provide page-specific titles and descriptions.
-   Include sitemap and robots configuration where supported.
-   Ensure keyboard navigation and visible focus states.
-   Label form controls and provide understandable validation messages.
-   Use appropriate alt text.
-   Respect reduced-motion preferences if animations are used.

------------------------------------------------------------------------

# 7. Content accuracy and confidentiality

This website represents me professionally. Accuracy is essential.

-   Do not invent client projects, testimonials, customers, awards,
    performance metrics or business results.
-   Do not claim that a demo is live until it works end to end.
-   Do not imply that personal demonstrations were paid client projects.
-   Do not misrepresent my role in work completed at an employer.
-   Do not publish employer-owned source code, private datasets,
    internal screenshots, confidential architecture or customer
    information.
-   Use independently recreated examples and public or synthetic
    datasets where needed.
-   Only use company names, logos and proprietary project details when I
    have permission.
-   Use clearly marked placeholders for information I have not supplied.

------------------------------------------------------------------------

# 8. Implementation phases

## Phase 1 --- Understand the repository and decisions

-   Inspect the existing repository before changing anything.
-   Identify the existing stack and project conventions.
-   Compare the repository with this proposed structure.
-   Ask for any missing technical decisions that block implementation.
-   Do not overwrite existing work without approval.

## Phase 2 --- Website foundation

-   Create the agreed folder structure.
-   Set up shared layout and navigation.
-   Create the main routes and page shells.
-   Create reusable components for solution cards, demo cards and case
    studies.
-   Add a central content/metadata source for solutions and demos.
-   Add basic tests and project documentation.

## Phase 3 --- Populate portfolio content

-   Add the seven solution categories.
-   Add About, Work and Contact content using only owner-approved
    information.
-   Add demo catalogue entries with accurate statuses.
-   Make the site navigable even before all demos are implemented.

## Phase 4 --- Demo framework

-   Create a reusable demo page structure.
-   Create a demo registry or equivalent metadata system.
-   Ensure each demo can have its own UI, API client, backend logic and
    tests.
-   Document the process for adding a new demo.

## Phase 5 --- First working demo

-   Implement Document Intelligence as the first flagship demo after
    confirming the model provider, backend, storage and deployment
    choices.
-   Use sample documents.
-   Show answers with source references.
-   Include unsupported-question behavior and error states.
-   Add request limits and safe file handling.

## Phase 6 --- Additional demos

Add the other solution demonstrations incrementally, testing each before
marking it Live.

## Phase 7 --- Production readiness

-   Review security and privacy.
-   Configure production environment variables.
-   Add rate limits and cost controls.
-   Run tests and static checks.
-   Verify mobile and desktop behavior.
-   Verify metadata and contact links.
-   Document deployment and operational procedures.

------------------------------------------------------------------------

# 9. Documentation Claude Code must maintain

Create and maintain:

-   `README.md` --- project overview, setup and common commands.
-   `docs/architecture/overview.md` --- application architecture and
    module boundaries.
-   `docs/development/local-setup.md` --- local development setup.
-   `docs/development/adding-a-demo.md` --- exact process for adding a
    new demo.
-   `docs/deployment/deployment.md` --- deployment procedure.
-   `docs/demos/` --- one document per demo describing behavior, inputs,
    architecture and limitations.
-   `docs/decisions/` --- important technical decisions and rationale.
-   `docs/security/` --- security and privacy checklist.

------------------------------------------------------------------------

# 10. Definition of done

The initial website foundation is complete when:

-   The homepage explains who I am and what I build.
-   All seven AI solution categories are presented.
-   The demos catalogue and individual demo page structure exist.
-   Work, About and Contact pages exist.
-   The folder structure supports independent demo development.
-   Demo statuses are accurate.
-   The site works on mobile and desktop.
-   There are no broken navigation links.
-   The project passes its agreed lint, type and test checks.
-   Setup and architecture documentation are present.
-   No secrets or confidential information are exposed.

The first release does **not** need seven completed AI applications. It
needs a strong, extensible website foundation and then one genuinely
working flagship demo.

------------------------------------------------------------------------

# 11. Instructions before implementation

Before coding, Claude Code should:

1.  Inspect the repository and report its current state.
2.  Read this entire brief.
3.  Present the proposed folder structure adapted to the actual stack I
    provide.
4.  List only the technical decisions that still need my input.
5.  Identify any conflicts with existing code.
6.  Propose a phased implementation plan.

Do not choose fonts, visual styling, colors, branding or detailed design
direction from this document. I will provide the design references and
design requirements separately.

Do not silently select paid APIs, incur usage costs, publish personal
information or deploy the website publicly without my approval.
