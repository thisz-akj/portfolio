export const DOCDESK_BASE = "/demos/document-intelligence/app";
export const DOCDESK_API = "/api/demos/document-intelligence";

export const docdeskNav = [
  { href: DOCDESK_BASE, label: "Library" },
  { href: `${DOCDESK_BASE}/compare`, label: "Compare" },
  { href: `${DOCDESK_BASE}/review`, label: "Review queue" },
  { href: `${DOCDESK_BASE}/quality`, label: "Quality" },
];

export const docHref = (id: string, tab?: "ask" | "fields" | "checks") => `${DOCDESK_BASE}/d/${id}${tab && tab !== "ask" ? `?tab=${tab}` : ""}`;
