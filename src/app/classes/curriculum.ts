export type FocusArea = { code: string; label: string };

export const FOCUS_AREAS = {
  ideas: [
    { code: "FC-AESTH",   label: "Aesthetic and Interpretive Analysis" },
    { code: "FC-CREATE",  label: "Creative Expression, Practice, and Production" },
    { code: "FC-PAST",    label: "Engagement with the Human Past" },
    { code: "FC-VALUES",  label: "Ethical and Civic Values" },
    { code: "FC-GLOBAL",  label: "Global Understanding and Engagement" },
    { code: "FC-NATSCI",  label: "Natural Scientific Investigation" },
    { code: "FC-POWER",   label: "Power and Society" },
    { code: "FC-QUANT",   label: "Quantitative Reasoning" },
    { code: "FC-KNOWING", label: "Ways of Knowing" },
    { code: "FC-LAB",     label: "Empirical Investigation Lab" },
  ] as FocusArea[],
  foundations: [
    { code: "FY-WRITING", label: "Writing at the Research University" },
    { code: "FY-SEMINAR", label: "First-Year Seminar" },
    { code: "FY-LAUNCH",  label: "First-Year Launch" },
    { code: "FY-THRIVE",  label: "College Thriving" },
    { code: "FY-DATA",    label: "Data Literacy Lab (Triple-I)" },
    { code: "GLBL-LANG",  label: "Global Language" },
  ] as FocusArea[],
  cle: [
    { code: "CLE-CIVIC",  label: "Civic Engagement & Public Service" },
    { code: "CLE-ARTS",   label: "Films, Music & Visual and Performing Arts" },
    { code: "CLE-CAREER", label: "Career Exploration and Leadership" },
    { code: "CLE-CAMPUS", label: "Campus Life and Personal Well-Being" },
  ] as FocusArea[],
};

export const ALL_FOCUS_AREAS: FocusArea[] = [
  ...FOCUS_AREAS.ideas,
  ...FOCUS_AREAS.foundations,
  ...FOCUS_AREAS.cle,
];

export function getFocusAreaLabel(code: string): string {
  return ALL_FOCUS_AREAS.find((f) => f.code === code)?.label ?? code;
}
