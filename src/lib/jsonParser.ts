// Parser for the prediction string format used in betting tips JSON files.
// Each prediction is stored as a pseudo-dict string, e.g.:
//   "{Time: 19:30, League: Germany Bundesliga, Home: Bayern Munich, Away: RB Leipzig, Prediction: Over+ 2,5 Goals, Rate: 1.35, ScoreHome: 0, ScoreAway: 0, CompetitionStatus: notStarted}"
// Note: values may contain commas (e.g. "Over+ 2,5 Goals" or "Score 1-1 or 1-2"), so we
// can't naively split by comma. We split by `, ` followed by a known key + `:`.

export type Prediction = {
  Time: string;
  League: string;
  Home: string;
  Away: string;
  Prediction: string;
  Rate: string;
  ScoreHome: string;
  ScoreAway: string;
  CompetitionStatus: string;
};

export type SectionGroup = {
  category: string; // FREE | VIP | BEST_OFFERS
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
};

/**
 * Parse a single pseudo-dict prediction string into a structured object.
 */
export function parsePredictionString(raw: string): Prediction {
  if (!raw || typeof raw !== "string") return { ...EMPTY_PREDICTION };

  // Strip leading/trailing braces and whitespace.
  let s = raw.trim();
  if (s.startsWith("{")) s = s.slice(1);
  if (s.endsWith("}")) s = s.slice(0, -1);
  s = s.trim();

  // Split on `, ` that is immediately followed by a known key + `:`.
  // Use a lookahead so the key is preserved in the next chunk.
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
 * Parse the full report JSON (either object or string) into structured sections.
 * Accepts both the "multitips" shape (FREE / VIP / BEST_OFFERS) and the "prime"
 * shape (FREE / VIP), as well as any object whose top-level arrays contain
 * { name, predictions: [string, ...] } sections.
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
  if (typeof obj.timestamp === "string") result.timestamp = obj.timestamp;

  // Treat any top-level array-valued key as a category of sections.
  const knownCategories = ["FREE", "VIP", "BEST_OFFERS"];
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (!Array.isArray(val)) continue;
    if (!knownCategories.includes(key) && val.length > 0 && typeof val[0] !== "object") {
      continue;
    }
    if (!result.categories.includes(key)) result.categories.push(key);

    for (const section of val) {
      if (!section || typeof section !== "object") continue;
      const sectionName = typeof section.name === "string" ? section.name : "(sin nombre)";
      const sectionKey = typeof section.section_key === "string" ? section.section_key : "";
      const sectionId =
        typeof section.section_id === "string" || typeof section.section_id === "number"
          ? String(section.section_id)
          : "";
      const apiUrl = typeof section.api_url === "string" ? section.api_url : "";
      const rawPreds = Array.isArray(section.predictions) ? section.predictions : [];

      const predictions: Prediction[] = rawPreds
        .map((p: unknown) => (typeof p === "string" ? parsePredictionString(p) : null))
        .filter((p: unknown): p is Prediction => p !== null);

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
      "No se encontraron secciones con predicciones. Revisa que el JSON tenga arreglos como FREE/VIP/BEST_OFFERS con objetos { name, predictions }.",
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
      });
    }
  }
  return rows;
}
