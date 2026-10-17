import * as XLSX from "xlsx";
import type { SpreadsheetRow, ParsedReport } from "./jsonParser";

const COLUMN_ORDER = [
  "Category",
  "Section",
  "SectionId",
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

const COLUMN_LABELS_ES: Record<string, string> = {
  Category: "Categoría",
  Section: "Sección",
  SectionId: "Sección ID",
  Time: "Hora",
  League: "Liga",
  Home: "Local",
  Away: "Visitante",
  Prediction: "Predicción",
  Rate: "Cuota",
  ScoreHome: "Marcador Local",
  ScoreAway: "Marcador Visitante",
  CompetitionStatus: "Estado",
};

/**
 * Build a worksheet with the columns reordered and labeled in Spanish.
 */
function buildSheet(rows: SpreadsheetRow[]): XLSX.WorkSheet {
  const labeled = rows.map((r) => {
    const out: Record<string, string> = {};
    for (const col of COLUMN_ORDER) {
      out[COLUMN_LABELS_ES[col]] = r[col] ?? "";
    }
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(labeled, {
    header: COLUMN_ORDER.map((c) => COLUMN_LABELS_ES[c]),
  });

  // Set reasonable column widths.
  const widths = [
    { wch: 14 }, // Categoría
    { wch: 22 }, // Sección
    { wch: 12 }, // Sección ID
    { wch: 8 }, // Hora
    { wch: 30 }, // Liga
    { wch: 24 }, // Local
    { wch: 24 }, // Visitante
    { wch: 28 }, // Predicción
    { wch: 8 }, // Cuota
    { wch: 14 }, // Marcador Local
    { wch: 14 }, // Marcador Visitante
    { wch: 16 }, // Estado
  ];
  (ws as any)["!cols"] = widths;
  return ws;
}

function timestampForFilename(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/**
 * Export all rows (all categories in a single sheet) to a .xlsx file.
 */
export function exportAllToXlsx(rows: SpreadsheetRow[], baseName = "tips"): void {
  if (rows.length === 0) return;
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Todas");
  XLSX.writeFile(wb, `${baseName}_${timestampForFilename()}.xlsx`);
}

/**
 * Export the report into a .xlsx file with one sheet per category.
 */
export function exportByCategoryToXlsx(report: ParsedReport, baseName = "tips"): void {
  if (report.groups.length === 0) return;
  const wb = XLSX.utils.book_new();
  for (const cat of report.categories) {
    const rows: SpreadsheetRow[] = [];
    for (const g of report.groups) {
      if (g.category !== cat) continue;
      for (const p of g.predictions) {
        rows.push({
          Category: g.category,
          Section: g.sectionName,
          SectionId: g.sectionId,
          ...p,
        });
      }
    }
    if (rows.length === 0) continue;
    const sheetName = cat.length > 31 ? cat.slice(0, 31) : cat;
    const ws = buildSheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  XLSX.writeFile(wb, `${baseName}_por_categoria_${timestampForFilename()}.xlsx`);
}

/**
 * Export all rows to a CSV file (UTF-8 with BOM so Excel opens it correctly).
 */
export function exportAllToCsv(rows: SpreadsheetRow[], baseName = "tips"): void {
  if (rows.length === 0) return;
  const header = COLUMN_ORDER.map((c) => COLUMN_LABELS_ES[c]);
  const escape = (val: string) => {
    const v = (val ?? "").toString();
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines: string[] = [];
  lines.push(header.join(","));
  for (const r of rows) {
    lines.push(COLUMN_ORDER.map((c) => escape(r[c] ?? "")).join(","));
  }
  // Prepend BOM and join with CRLF so Excel reads UTF-8 + Windows line endings.
  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}_${timestampForFilename()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a JSON file with the parsed structure (useful for inspection / re-import).
 */
export function exportJson(report: ParsedReport, baseName = "tips"): void {
  const payload = {
    app: report.app,
    timestamp: report.timestamp,
    categories: report.categories,
    groups: report.groups,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}_parsed_${timestampForFilename()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
