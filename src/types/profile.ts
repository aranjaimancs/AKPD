export type TimelineEntry = {
  term: string;
  highlights: string[];
};

export type Profile = {
  slug: string;
  name: string;
  headshot: string;
  hometown: string | null;
  majors: string[];
  minors: string[];
  pledgeClass: string;
  gradYear: number;
  destinationTitle: string;
  destinationCompany: string;
  tags: string[];
  summary: string;
  timeline: TimelineEntry[];
  programs: string[];
  recruiting: string[];
  advice: string[];
  flags: string[];
  linkedIn?: string;
  email?: string;
  website?: string;
};

/** Lightweight record written to seniors.json index */
export type SeniorIndex = {
  slug: string;
  name: string;
  headshot: string;
  majors: string[];
  minors: string[];
  pledgeClass: string;
  gradYear: number;
  destinationTitle: string;
  destinationCompany: string;
  summary: string;
  tags: string[];
  linkedIn?: string;
  email?: string;
  website?: string;
};
