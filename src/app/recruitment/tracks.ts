export type Track = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  /** Details the user will fill in — all optional until content is ready */
  timeline?: string;
  interviewFormat?: string;
  keyPrograms?: string[];
  tips?: string[];
  resources?: { label: string; url: string }[];
};

export const TRACKS: Track[] = [
  {
    id: "investment-banking",
    name: "Investment Banking",
    shortName: "IB",
    description:
      "M&A advisory, capital markets, and corporate finance. Bulge bracket, elite boutique, and middle market.",
  },
  {
    id: "consulting",
    name: "Management Consulting",
    shortName: "Consulting",
    description:
      "Strategy, operations, and transformation work across MBB, Big 4, and boutique advisory firms.",
  },
  {
    id: "sales-trading",
    name: "Sales & Trading",
    shortName: "S&T",
    description:
      "Equities, fixed income, FX, and derivatives desks at bulge brackets and prop trading shops.",
  },
  {
    id: "asset-management",
    name: "Asset Management",
    shortName: "AM",
    description:
      "Long-only funds, hedge funds, and multi-asset platforms. Fundamental and quantitative strategies.",
  },
  {
    id: "private-equity",
    name: "Private Equity",
    shortName: "PE",
    description:
      "LBO, growth equity, and venture. Typically recruited post-IB, but some direct undergrad paths exist.",
  },
  {
    id: "software-engineering",
    name: "Software Engineering",
    shortName: "SWE",
    description:
      "Full-stack, backend, infrastructure, and ML engineering roles across tech, fintech, and finance.",
  },
  {
    id: "product-management",
    name: "Product Management",
    shortName: "PM",
    description:
      "Defining and shipping products at tech companies, fintech startups, and large financial institutions.",
  },
  {
    id: "accounting",
    name: "Accounting & Audit",
    shortName: "Accounting",
    description:
      "Public accounting, Big 4 audit/tax/advisory, and corporate finance & accounting roles.",
  },
  {
    id: "corporate-finance",
    name: "Corporate Finance / FP&A",
    shortName: "Corp Fin",
    description:
      "Internal finance roles at corporations — FP&A, treasury, strategy, and rotational programs.",
  },
  {
    id: "real-estate",
    name: "Real Estate",
    shortName: "Real Estate",
    description:
      "REPE, REITs, brokerage, and real estate investment management and development tracks.",
  },
];

/** Icon paths keyed by track id — add SVG path data here */
export const TRACK_ICONS: Record<string, string> = {
  "investment-banking":
    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  consulting:
    "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
  "sales-trading":
    "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z",
  "asset-management":
    "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "private-equity":
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  "software-engineering":
    "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  "product-management":
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  accounting:
    "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z",
  "corporate-finance":
    "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  "real-estate":
    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
};
