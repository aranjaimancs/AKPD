#!/usr/bin/env node
/**
 * scripts/compile-profiles.ts
 *
 * For each folder in content/seniors/:
 *   1. Read meta.json + notes.md
 *   2. Skip if notes unchanged (hash cache), unless --force
 *   3. Call OpenAI API to extract structured data
 *   4. Merge: meta.json always wins
 *   5. Write profile.generated.json
 *
 * Then write src/data/seniors.json (lightweight index for the grid page).
 *
 * Usage:
 *   npm run compile             # skip unchanged profiles
 *   npm run compile -- --force  # recompile everything
 */

import OpenAI from "openai";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT = path.resolve(process.cwd());
const CONTENT_DIR = path.join(ROOT, "content", "seniors");
const DATA_DIR = path.join(ROOT, "src", "data");
const HASH_CACHE_PATH = path.join(DATA_DIR, ".compile-hashes.json");

// ── CLI args ──────────────────────────────────────────────────────────────────
const FORCE = process.argv.includes("--force");

// ── Types ─────────────────────────────────────────────────────────────────────
type Meta = {
  name: string;
  headshot: string;
  gradYear: number;
  pledgeClass: string;
  destinationTitle: string;
  destinationCompany: string;
  visible: boolean;
};

type Profile = {
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
  timeline: { term: string; highlights: string[] }[];
  programs: string[];
  recruiting: string[];
  advice: string[];
  flags: string[];
};

type SeniorIndex = {
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
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function md5(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

function loadHashCache(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(HASH_CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveHashCache(cache: Record<string, string>): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(HASH_CACHE_PATH, JSON.stringify(cache, null, 2));
}

// ── AI extraction ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a data-extraction assistant for a college business fraternity's senior profiles website.
You will be given raw interview notes for a graduating senior.
Your job is to extract structured information INTO EXACTLY the JSON schema below.

RULES:
- Output RAW JSON only — no markdown code fences, no preamble, no trailing text.
- Extract ONLY information that is explicitly present in the notes. Do NOT invent or infer details that aren't stated.
- For anything ambiguous, contradictory, or unclear, add a note to the "flags" array rather than guessing.
- The "summary" should be 1-2 polished sentences suitable for a profile card (third person, professional tone).
- The "tags" should be short track labels (2-4 words max each), e.g. ["Finance","Sales & Trading","Buyside-curious","Capital Markets"].
- The "timeline" array must preserve chronological order exactly as in the notes.
- The "recruiting" array should focus specifically on recruiting timeline, process length, offer timing, reneges, and interview format — pulled from anywhere in the notes.
- The "advice" array should be distilled, actionable takeaways from the notes.
- You must NOT set name, headshot, gradYear, pledgeClass, destinationTitle, or destinationCompany — leave those as empty strings/0/null; they come from meta.json.

JSON SCHEMA (output must match this exactly):
{
  "slug": "",
  "name": "",
  "headshot": "",
  "hometown": string | null,
  "majors": string[],
  "minors": string[],
  "pledgeClass": "",
  "gradYear": 0,
  "destinationTitle": "",
  "destinationCompany": "",
  "tags": string[],
  "summary": string,
  "timeline": [{ "term": string, "highlights": string[] }],
  "programs": string[],
  "recruiting": string[],
  "advice": string[],
  "flags": string[]
}`;

async function extractProfile(
  client: OpenAI,
  slug: string,
  notes: string
): Promise<Profile> {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2048,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Here are the interview notes for slug "${slug}":\n\n${notes}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const cleaned = stripFences(raw);

  try {
    return JSON.parse(cleaned) as Profile;
  } catch (err) {
    throw new Error(
      `Failed to parse AI response for ${slug}.\nRaw output:\n${raw}\nParse error: ${err}`
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: OPENAI_API_KEY not set. Add it to .env.local and re-run."
    );
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const hashCache = loadHashCache();
  const slugs = fs
    .readdirSync(CONTENT_DIR)
    .filter((d) => fs.statSync(path.join(CONTENT_DIR, d)).isDirectory());

  const index: SeniorIndex[] = [];
  let compiled = 0;
  let skipped = 0;

  for (const slug of slugs) {
    const dir = path.join(CONTENT_DIR, slug);
    const metaPath = path.join(dir, "meta.json");
    const notesPath = path.join(dir, "notes.md");
    const outputPath = path.join(dir, "profile.generated.json");

    if (!fs.existsSync(metaPath) || !fs.existsSync(notesPath)) {
      console.warn(`  [SKIP] ${slug} — missing meta.json or notes.md`);
      continue;
    }

    const meta: Meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

    if (!meta.visible) {
      console.log(`  [SKIP] ${slug} — visible: false`);
      continue;
    }

    const notes = fs.readFileSync(notesPath, "utf8");
    const hash = md5(notes);

    if (!FORCE && hashCache[slug] === hash && fs.existsSync(outputPath)) {
      console.log(`  [SKIP] ${slug} — notes unchanged (use --force to recompile)`);
      skipped++;
      const existing: Profile = JSON.parse(fs.readFileSync(outputPath, "utf8"));
      index.push(toIndex(existing));
      continue;
    }

    console.log(`  [COMPILE] ${slug}…`);
    try {
      const aiData = await extractProfile(client, slug, notes);

      // Merge: meta fields always win
      const profile: Profile = {
        ...aiData,
        slug,
        name: meta.name,
        headshot: meta.headshot,
        gradYear: meta.gradYear,
        pledgeClass: meta.pledgeClass,
        destinationTitle: meta.destinationTitle,
        destinationCompany: meta.destinationCompany,
      };

      fs.writeFileSync(outputPath, JSON.stringify(profile, null, 2));
      hashCache[slug] = hash;
      compiled++;
      index.push(toIndex(profile));
      console.log(`  [DONE]   ${slug}`);

      if (profile.flags.length > 0) {
        console.log(
          `  [FLAGS]  ${slug} has ${profile.flags.length} flag(s) for review:`
        );
        profile.flags.forEach((f) => console.log(`           • ${f}`));
      }
    } catch (err) {
      console.error(`  [ERROR]  ${slug}: ${err}`);
    }
  }

  // Write combined index
  const indexPath = path.join(DATA_DIR, "seniors.json");
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  saveHashCache(hashCache);

  console.log(
    `\nDone. Compiled: ${compiled}, Skipped: ${skipped}. Index → src/data/seniors.json`
  );
}

function toIndex(p: Profile): SeniorIndex {
  return {
    slug: p.slug,
    name: p.name,
    headshot: p.headshot,
    majors: p.majors,
    minors: p.minors,
    pledgeClass: p.pledgeClass,
    gradYear: p.gradYear,
    destinationTitle: p.destinationTitle,
    destinationCompany: p.destinationCompany,
    summary: p.summary,
    tags: p.tags,
  };
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
