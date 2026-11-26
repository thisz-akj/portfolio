import type { PitchArticle } from "@/types/content";

/**
 * The main client pitch: the long-form article behind the "AI Workflow Automation" card (layout "pitch").
 * Outcomes and services only: what it connects to and what it does, never how it's built (owner rule).
 * Tool names below are the customer's own tools it plugs into, not the stack. No invented statistics.
 * Each point is made once: problem → connections → example → services → benefits → why → industries → process → FAQ.
 */
export const automationArticle: PitchArticle = {
  kicker: "AI automation · Integrations · Agents that do the work",
  lede: [
    "Your business already runs on tools: the phone, WhatsApp, an inbox, a calendar, a CRM, an accounts package, a few spreadsheets. They don't talk to each other, so your people do the talking for them.",
    "AI workflow automation connects those tools and puts a capable assistant in the middle. It reads the message, checks the calendar, the map and the account, does the work in the right system and tells the right person, day or night.",
  ],
  cost: [
    { title: "Enquiries that go cold", text: "A lead messages at 9:40 pm. By the morning reply, they've booked with whoever answered first." },
    { title: "Skilled people retyping", text: "Hours go into copying emails, invoices and forms from one app into another." },
    { title: "Gaps between tools", text: "Booked in the calendar but not the CRM; paid, but the order still says pending. Mistakes live in the gaps." },
    { title: "Follow-ups left to memory", text: "Reminders, renewals and overdue invoices only happen when someone remembers." },
  ],
  connections: [
    {
      icon: "phone",
      name: "Phone & voice calls",
      examples: "Business number, missed-call lines",
      does: ["Answers and books on the call, day and night", "Hands complex calls to a person, with a summary"],
    },
    {
      icon: "whatsapp",
      name: "WhatsApp & SMS",
      examples: "WhatsApp Business, SMS, website chat",
      does: ["Replies instantly, understands voice notes and photos", "Sends confirmations, reminders and payment links"],
    },
    {
      icon: "mail",
      name: "Email",
      examples: "Gmail, Outlook, shared inboxes",
      does: ["Sorts by intent and urgency, pulls details from attachments", "Drafts replies in your tone for approval"],
    },
    {
      icon: "calendar",
      name: "Calendars",
      examples: "Google Calendar, Outlook, Calendly",
      does: ["Books across people and branches with no double-booking", "Reminds, reschedules and fills cancellations"],
    },
    {
      icon: "map",
      name: "Maps & location",
      examples: "Google Maps, addresses, pin codes",
      does: ["Checks service area and assigns the nearest person", "Plans routes and shares arrival times"],
    },
    {
      icon: "auth",
      name: "Sign-in & verification",
      examples: "OTP, Google / Microsoft sign-in, roles",
      does: ["Verifies customers before sharing anything private", "Gives staff access by role"],
    },
    {
      icon: "crm",
      name: "CRM",
      examples: "Zoho, HubSpot, Salesforce, custom",
      does: ["Logs every lead, call and chat automatically", "Routes leads and nudges when a deal goes quiet"],
    },
    {
      icon: "money",
      name: "Accounts, payments & ERP",
      examples: "Tally, Zoho Books, UPI links, Razorpay",
      does: ["Turns an order into invoice, stock and delivery", "Matches payments and chases overdue ones"],
    },
    {
      icon: "docs",
      name: "Documents & forms",
      examples: "Invoices, POs, contracts, IDs, e-sign",
      does: ["Reads documents and fills in the fields", "Flags mismatches, generates quotes and letters"],
    },
    {
      icon: "sheet",
      name: "Spreadsheets & reports",
      examples: "Google Sheets, Excel, Airtable, Notion",
      does: ["Keeps sheets and systems in sync", "Builds the weekly report and sends it to you"],
    },
    {
      icon: "team",
      name: "Team chat & approvals",
      examples: "Slack, Teams, WhatsApp groups",
      does: ["Sends the right alert to the right person", "One-tap approvals for refunds, discounts and POs"],
    },
    {
      icon: "shop",
      name: "Website & online store",
      examples: "Your site, Shopify, WooCommerce",
      does: ["Answers product and order questions", "Handles returns and recovers abandoned carts"],
    },
  ],
  journey: {
    title: "One message, many tools, zero copy-paste",
    intro: "A home-services business, once everything is connected. Illustrative example.",
    steps: [
      { time: "9:42 pm", via: "WhatsApp", text: "A customer sends a photo of a leaking pipe and a Hinglish voice note: can someone come tomorrow?" },
      { time: "9:43 pm", via: "Maps & calendar", text: "The address is in the service area; it offers three slots from the two nearest plumbers. The customer picks 11 am." },
      { time: "9:44 pm", via: "OTP, CRM & payments", text: "Number verified, customer and job created with the photo, visit fee paid by link, booking confirmed." },
      { time: "10:30 am", via: "Maps & WhatsApp", text: "The plumber gets the route; the customer gets a live arrival time." },
      { time: "1:15 pm", via: "Accounts & email", text: "Invoice raised and emailed, payment recorded, review requested." },
    ],
    outcome: "Booked at night, served next day, paid and reviewed, and nobody on your team typed a thing.",
  },
  better: [
    { area: "Response time", before: "Hours, or the next day", after: "Seconds, any time" },
    { area: "Leads", before: "Lost after hours and on busy days", after: "Every one answered and followed up" },
    { area: "Data entry", before: "Retyped across apps", after: "Entered once, everywhere" },
    { area: "Visibility", before: "Ask around, check six apps", after: "One dashboard and a daily summary" },
    { area: "Growth", before: "More customers, more admin hires", after: "Volume grows, admin doesn't" },
  ],
  usp: [
    { title: "Built around your real process", text: "I map the actual steps, exceptions and approvals with the people who do the work. No templates." },
    { title: "Uses the tools you already have", text: "No switching software: WhatsApp, Gmail, Tally and a Google Sheet are fine." },
    { title: "You stay in charge", text: "Unusual or sensitive cases go to a person. Every action is logged and can be undone." },
    { title: "Secure by design", text: "Customers are verified, staff see only what their role allows, and data stays in your accounts." },
    { title: "Tested before it goes live", text: "I measure it on real examples from your business, so you know how well it works before switching it on." },
  ],
  industries: [
    { name: "Clinics & healthcare", examples: ["Bookings by phone and WhatsApp, reminders that cut no-shows", "Verified patients get reports and follow-ups"] },
    { name: "Real estate", examples: ["Instant replies to portal and ad leads", "Site visits booked by location and agent calendar"] },
    { name: "Home & field services", examples: ["Jobs booked from photos and voice notes", "Nearest technician, route, invoice and review"] },
    { name: "Distribution & manufacturing", examples: ["Orders from email, WhatsApp and PDFs straight into the ERP", "Low-stock purchase orders drafted for approval"] },
    { name: "Retail & e-commerce", examples: ["Order status, returns and refunds in chat", "Abandoned carts and reviews followed up"] },
    { name: "Education & coaching", examples: ["Admission enquiries and demo classes booked", "Fee reminders and notices to parents"] },
    { name: "CA & professional services", examples: ["Client documents collected, checked and filed", "Deadline reminders to every client"] },
    { name: "Logistics & HR", examples: ["Shipment status and proof of delivery handled", "CVs shortlisted and interviews scheduled"] },
  ],
  services: [
    { name: "Automation audit & roadmap", text: "Map your workflows, find where the hours go, and rank what to automate first.", get: ["Process map", "Prioritised plan"] },
    { name: "AI agents for calls, WhatsApp & email", text: "Answer customers, capture leads and resolve routine requests on the channels they already use.", get: ["Answers from your own information", "Hand-off to a person with context"] },
    { name: "Booking & field operations", text: "Calendars, maps and reminders working together, from enquiry to the technician at the door.", get: ["No double-bookings", "Routes and reminders"] },
    { name: "CRM, ERP & accounts integration", text: "Sales, stock, invoices and payments kept in sync, with order-to-cash running itself.", get: ["Data entered once", "Approvals where money moves"] },
    { name: "Documents, reports & dashboards", text: "Documents read and filed, numbers assembled and delivered where you'll see them.", get: ["Fields filled without typing", "Daily summary on WhatsApp or email"] },
    { name: "Care & improvement", text: "Monitoring, fixes and new workflows as your business changes.", get: ["Monthly report", "New workflows as you grow"] },
  ],
  process: [
    { step: "Discover", text: "Walk through how the work really happens today." },
    { step: "Design & build", text: "Plan one workflow in plain language, then connect your tools in a safe test setup." },
    { step: "Test with your team", text: "Try it on real examples, measure it, fix what isn't good enough." },
    { step: "Go live & grow", text: "Start with approvals on, loosen as trust builds, then add the next workflow." },
  ],
  faq: [
    { q: "Will it sound like a robot?", a: "No. It follows your tone and replies in the customer's language, including Hindi and Hinglish. Customers can always reach a person." },
    { q: "How soon will I see results?", a: "We start with one high-value workflow, so you see it working early and decide what comes next from results." },
    { q: "What does it cost to run?", a: "Kept low on purpose: AI is used only where it adds value, and routine steps follow fixed rules. You'll know the running cost before we build." },
    { q: "Who owns it?", a: "You do. It runs on your accounts, with documentation for day-to-day use." },
  ],
  close: {
    title: "Tell me the task your team hates most.",
    text: "Send me one workflow that eats your week. I'll tell you honestly whether it's worth automating and what it would change.",
  },
};
