// Parser for betting tips JSON files. Supports 3 input formats:
//
// 1) MultiTips / Prime (predictions are pseudo-dict strings):
//    { app, timestamp, FREE: [...], VIP: [...], BEST_OFFERS: [...] }
//    Section: { name, section_key, section_id, api_url, predictions: ["{Time: ..., League: ..., ...}"] }
//
// 2) Betbook (predictions are JSON objects; some sections only contain raw_content for paywall screens):
//    { app, extracted_at, device, tabs: { FREE: [...], VIP: [...], OFFER: [...] } }
//    Section: { category, tab, predictions: [{ home, visitor, league, time, bet, rate, result }] }
//    OR     : { category, tab, predictions: [{ raw_content: [...] }] }  (skipped — paywall screen)
//
// 3) Betonair (matches are JSON objects under `matches`):
//    { app, timestamp, tabs: { LIBRE: [...], VIP: [...] } }
//    Section: { index, name, tab, status, lock_reason, matches_count, matches: [{ flag, league, time, home_team, away_team, tip, odds, raw }] }

export type Prediction = {
  Time: string;
  League: string;
  Home: string;
  Away: string;
  Prediction: string; // "Prediction" (MultiTips/Prime), "bet" (Betbook), "tip" (Betonair)
  Rate: string; // "Rate" / "odds"
  ScoreHome: string;
  ScoreAway: string;
  CompetitionStatus: string; // "CompetitionStatus" / "result" / "status"
  Flag: string; // betonair-only (emoji)
};

export type SectionGroup = {
  category: string; // FREE | VIP | BEST_OFFERS | OFFER | LIBRE | ...
  sectionName: string;
  sectionKey: string;
  sectionId: string;
  apiUrl: string;
  predictions: Prediction[];
};

export type ParsedReport = {
  app?: string;
  timestamp?: string;
  groups: SectionGroup[];
  categories: string[];
};

const PREDICTION_KEYS = [
  "Time",
  "League",
  "Home",
  "Away",
  "Prediction",
  "Rate",
  "ScoreHome",
  "ScoreAway",
  "CompetitionStatus",
] as const;

const EMPTY_PREDICTION: Prediction = {
  Time: "",
  League: "",
  Home: "",
  Away: "",
  Prediction: "",
  Rate: "",
  ScoreHome: "",
  ScoreAway: "",
  CompetitionStatus: "",
  Flag: "",
};

/**
 * Parse a single pseudo-dict prediction string (MultiTips/Prime format) into a
 * structured object. Handles commas inside values like "Over+ 2,5 Goals" by
 * splitting on `, ` followed by a known key + `:`.
 */
export function parsePredictionString(raw: string): Prediction {
  if (!raw || typeof raw !== "string") return { ...EMPTY_PREDICTION };

  let s = raw.trim();
  if (s.startsWith("{")) s = s.slice(1);
  if (s.endsWith("}")) s = s.slice(0, -1);
  s = s.trim();

  const keyLookahead = PREDICTION_KEYS.map((k) => `${k}:`).join("|");
  const splitter = new RegExp(`,\\s+(?=(?:${keyLookahead}))`, "g");
  const parts = s.split(splitter);

  const result: Prediction = { ...EMPTY_PREDICTION };
  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) continue;
    const key = part.slice(0, colonIdx).trim();
    const value = part.slice(colonIdx + 1).trim();
    if (key in EMPTY_PREDICTION) {
      (result as any)[key] = value;
    }
  }
  return result;
}

/**
 * Normalize a JSON-object prediction (Betbook or Betonair) into our Prediction type.
 * Returns null for entries that look like paywall/notification screens (only
 * `raw_content` with no actual match data).
 */
function normalizeObjectPrediction(obj: any): Prediction | null {
  if (!obj || typeof obj !== "object") return null;

  // Skip paywall / notification screens: Betbook sections like ELITE VIP contain
  // predictions: [{ raw_content: ["[txtCategory] ...", "[txtPrice] ...", ...] }]
  // with no real match data.
  const hasRawContentOnly =
    Array.isArray(obj.raw_content) &&
    !obj.home &&
    !obj.home_team &&
    !obj.league;
  if (hasRawContentOnly) return null;

  const get = (k: string) => (typeof obj[k] === "string" || typeof obj[k] === "number" ? String(obj[k]) : "");

  // Betbook object: { home, visitor, league, time, bet, rate, result }
  // Betonair object: { flag, league, time, home_team, away_team, tip, odds, raw }
  return {
    Time: get("time") || get("Time"),
    League: get("league") || get("League"),
    Home: get("home") || get("home_team") || get("Home"),
    Away: get("visitor") || get("away_team") || get("Away"),
    Prediction: get("bet") || get("tip") || get("Prediction"),
    Rate: get("rate") || get("odds") || get("Rate"),
    ScoreHome: get("scoreHome") || get("ScoreHome"),
    ScoreAway: get("scoreAway") || get("ScoreAway"),
    CompetitionStatus: get("result") || get("status") || get("CompetitionStatus"),
    Flag: get("flag"),
  };
}

/**
 * Walk a single section object and extract its predictions/matches into our
 * unified Prediction[] shape.
 */
function extractSectionPredictions(section: any): Prediction[] {
  const raw = Array.isArray(section.predictions)
    ? section.predictions
    : Array.isArray(section.matches)
      ? section.matches
      : [];
  const out: Prediction[] = [];
  for (const p of raw) {
    if (typeof p === "string") {
      const parsed = parsePredictionString(p);
      if (parsed.Prediction || parsed.Home || parsed.League) out.push(parsed);
    } else if (p && typeof p === "object") {
      const norm = normalizeObjectPrediction(p);
      if (norm && (norm.Prediction || norm.Home || norm.League)) out.push(norm);
    }
  }
  return out;
}

/**
 * Parse the full report JSON (object or string) into structured sections.
 * Auto-detects the 3 supported shapes:
 *   - MultiTips/Prime: top-level FREE/VIP/BEST_OFFERS arrays of { name, predictions }
 *   - Betbook: nested under `tabs.{FREE,VIP,OFFER}` with sections { category, predictions }
 *   - Betonair: nested under `tabs.{LIBRE,VIP}` with sections { name, matches }
 */
export function parseReport(input: unknown): ParsedReport {
  const result: ParsedReport = { groups: [], categories: [] };

  let obj: any = input;
  if (typeof input === "string") {
    try {
      obj = JSON.parse(input);
    } catch {
      throw new Error("El texto no es JSON válido.");
    }
  }
  if (!obj || typeof obj !== "object") {
    throw new Error("El JSON no es un objeto válido.");
  }

  if (typeof obj.app === "string") result.app = obj.app;
  // Betbook uses `extracted_at`, fall back to that for the timestamp.
  if (typeof obj.timestamp === "string") result.timestamp = obj.timestamp;
  else if (typeof obj.extracted_at === "string") result.timestamp = obj.extracted_at;

  // Betbook / Betonair wrap categories under a `tabs` object.
  // If `tabs` exists, iterate its keys. Otherwise, iterate top-level keys.
  const container =
    obj.tabs && typeof obj.tabs === "object" && !Array.isArray(obj.tabs)
      ? obj.tabs
      : obj;

  const knownCategories = [
    "FREE",
    "VIP",
    "BEST_OFFERS",
    "OFFER",
    "LIBRE",
  ];
  for (const key of Object.keys(container)) {
    const val = container[key];
    if (!Array.isArray(val)) continue;
    // Skip arrays of primitives (e.g. logcat-style line arrays).
    if (val.length > 0 && typeof val[0] !== "object") continue;
    // Skip arrays whose items don't look like sections (no `name`, `category`,
    // `predictions`, or `matches`).
    if (
      val.length > 0 &&
      !val[0].name &&
      !val[0].category &&
      !val[0].predictions &&
      !val[0].matches
    ) {
      continue;
    }

    if (!result.categories.includes(key)) result.categories.push(key);

    for (const section of val) {
      if (!section || typeof section !== "object") continue;
      const sectionName =
        typeof section.name === "string"
          ? section.name
          : typeof section.category === "string"
            ? section.category
            : "(sin nombre)";
      const sectionKey = typeof section.section_key === "string" ? section.section_key : "";
      const sectionId =
        typeof section.section_id === "string" || typeof section.section_id === "number"
          ? String(section.section_id)
          : typeof section.index === "number"
            ? String(section.index)
            : "";
      const apiUrl = typeof section.api_url === "string" ? section.api_url : "";
      const predictions = extractSectionPredictions(section);

      result.groups.push({
        category: key,
        sectionName,
        sectionKey,
        sectionId,
        apiUrl,
        predictions,
      });
    }
  }

  if (result.groups.length === 0) {
    throw new Error(
      "No se encontraron secciones con predicciones. Formatos soportados: MultiTips/Prime (FREE/VIP/BEST_OFFERS con { name, predictions }), Betbook (tabs.FREE/VIP/OFFER con { category, predictions }), Betonair (tabs.LIBRE/VIP con { name, matches }).",
    );
  }

  return result;
}

/**
 * Flatten all groups into a single row list suitable for spreadsheet export.
 * Adds Category and Section columns so each row carries full context.
 */
export type SpreadsheetRow = Prediction & {
  Category: string;
  Section: string;
  SectionId: string;
};

export function flattenForSpreadsheet(report: ParsedReport): SpreadsheetRow[] {
  const rows: SpreadsheetRow[] = [];
  for (const g of report.groups) {
    for (const p of g.predictions) {
      rows.push({
        Category: g.category,
        Section: g.sectionName,
        SectionId: g.sectionId,
        Time: p.Time,
        League: p.League,
        Home: p.Home,
        Away: p.Away,
        Prediction: p.Prediction,
        Rate: p.Rate,
        ScoreHome: p.ScoreHome,
        ScoreAway: p.ScoreAway,
        CompetitionStatus: p.CompetitionStatus,
        Flag: p.Flag,
      });
    }
  }
  return rows;
}