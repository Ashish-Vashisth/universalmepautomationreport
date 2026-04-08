/**
 * JJM SWSM Daily Report — core data processing
 * TypeScript port of report.py (Python/pandas logic)
 * Uses SheetJS (xlsx) for Excel parsing — all computation done in-browser.
 */

import * as XLSX from "xlsx-js-style";
import type {
  SchemeRow,
  LpcdRow,
  LessRow,
  ZeroRow,
  TodayZeroRow,
  AbnormalRow,
  CriticalRow,
  SummaryCount,
  SeveritySummary,
  AbnormalParamSummary,
  ReportResult,
} from "@/types";

// ---------------------------------------------------------------------------
// Excel parsing helpers
// ---------------------------------------------------------------------------

export function parseExcel(buffer: ArrayBuffer): SchemeRow[] {
  // Try standard xlsx/xlsm parse first
  try {
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<SchemeRow>(ws, {
      defval: null,
      raw: false,
    });
    // If no __EMPTY columns exist, headers are clean — return directly
    const hasMergedHeaders =
      raw.length > 0 &&
      Object.keys(raw[0]).some((k) => k.startsWith("__EMPTY"));
    if (raw.length > 0 && Object.keys(raw[0]).length >= 5 && !hasMergedHeaders)
      return raw;
    // Sheet uses merged-cell headers spanning row 1+2 — rebuild with header:1
    const arr = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
    if (arr.length > 2) {
      // Flatten two-row header: forward-fill h1 across merged cells, then join with h2
      const h1 = arr[0] as string[];
      const h2 = arr[1] as string[];
      let lastH1 = "";
      const headers = h1.map((v, i) => {
        const a = String(v || "").trim();
        if (a) lastH1 = a;
        const parent = a || lastH1;
        const b = String(h2[i] || "").trim();
        return parent && b ? `${parent} ${b}` : parent || b;
      });
      return arr.slice(2).map((row) => {
        const obj: SchemeRow = {};
        headers.forEach((h, i) => { if (h) obj[h] = (row as string[])[i] ?? null; });
        return obj;
      });
    }
    return raw;
  } catch {
    // Fallback: try reading as HTML (some Indian gov .xls exports are HTML tables)
    const decoder = new TextDecoder("utf-8");
    const html = decoder.decode(buffer);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const tables = Array.from(doc.querySelectorAll("table"));
    if (!tables.length) throw new Error("Could not parse the uploaded file as Excel or HTML table.");
    // Pick largest table
    const table = tables.reduce((a, b) => a.rows.length >= b.rows.length ? a : b);
    const rows = Array.from(table.rows);
    if (rows.length < 2) throw new Error("Table has no data rows.");
    const headers = Array.from(rows[0].cells).map((c) => c.textContent?.trim() ?? "");
    return rows.slice(1).map((row) => {
      const obj: SchemeRow = {};
      Array.from(row.cells).forEach((cell, i) => {
        if (headers[i]) obj[headers[i]] = cell.textContent?.trim() ?? null;
      });
      return obj;
    });
  }
}

/** Normalize column names: strip all non-alphanumeric characters, lowercase */
function normalizeKey(k: string): string {
  return k.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

type NormMap = Record<string, string>; // original key -> normalized key

function buildNormMap(row: SchemeRow): NormMap {
  const map: NormMap = {};
  for (const k of Object.keys(row)) {
    map[k] = normalizeKey(k);
  }
  return map;
}

/**
 * Find a column whose normalized name contains ALL needle fragments.
 * Falls back to matching ANY single needle if the all-match fails,
 * preferring the candidate with the most fragment hits.
 */
function findCol(normMap: NormMap, ...needles: string[]): string {
  // Pass 1: all fragments must match
  for (const [orig, norm] of Object.entries(normMap)) {
    if (needles.every((n) => norm.includes(n))) return orig;
  }
  // Pass 2: most fragments match (greedy)
  let best: string | null = null;
  let bestScore = 0;
  for (const [orig, norm] of Object.entries(normMap)) {
    const score = needles.filter((n) => norm.includes(n)).length;
    if (score > bestScore) { bestScore = score; best = orig; }
  }
  if (best && bestScore >= Math.ceil(needles.length / 2)) return best;

  const available = Object.keys(normMap).slice(0, 15).join(", ");
  throw new Error(
    `Could not find column [${needles.join(", ")}]. ` +
    `Available columns (first 15): ${available}`
  );
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeStr(v: unknown): string | null {
  const s = toStr(v);
  return s === "" || s.toLowerCase() === "none" ? null : s;
}

// ---------------------------------------------------------------------------
// Build LPCD Status
// ---------------------------------------------------------------------------
export function buildLpcdStatus(rows: SchemeRow[]): LpcdRow[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  if (keys.length < 20) {
    throw new Error(
      `Source file has only ${keys.length} columns. Need at least 20.`
    );
  }
  // Columns 0,1,2,17,18,19 (0-indexed)
  const c0 = keys[0];
  const c1 = keys[1];
  const c2 = keys[2];
  const c17 = keys[17];
  const c18 = keys[18];
  const c19 = keys[19];

  return rows.map((r) => ({
    "Sno.": r[c0] ?? null,
    "Scheme Id": safeStr(r[c1]),
    "Scheme Name": safeStr(r[c2]),
    "Avg LPCD (Yesterday)": toNum(r[c17]),
    "Avg LPCD (Weekly)": toNum(r[c18]),
    "Avg LPCD (Monthly)": toNum(r[c19]),
  }));
}

// ---------------------------------------------------------------------------
// Build main report (less than threshold, zero/inactive, today zero)
// ---------------------------------------------------------------------------
export function buildReport(
  rows: SchemeRow[],
  threshold = 75
): {
  lessRows: LessRow[];
  zeroRows: ZeroRow[];
  todayZeroRows: TodayZeroRow[];
} {
  if (!rows.length) return { lessRows: [], zeroRows: [], todayZeroRows: [] };

  const normMap = buildNormMap(rows[0]);

  const schemeIdCol = findCol(normMap, "schemeid");
  const schemeNameCol = findCol(normMap, "schemename");
  const dailyDemandCol = findCol(normMap, "waterdemand", "meter3", "daily");
  const todayProdCol = findCol(normMap, "today", "waterproduction", "meter3");
  const lastDateCol = findCol(normMap, "lastdatareceivedate");

  // Yesterday OHT supply
  let yestProdCol: string | null = null;
  for (const [orig, norm] of Object.entries(normMap)) {
    if (
      norm.includes("oht") &&
      norm.includes("watersupply") &&
      norm.includes("meter3") &&
      norm.includes("yesterday")
    ) {
      yestProdCol = orig;
      break;
    }
  }
  if (!yestProdCol) {
    throw new Error(
      "Could not find 'OHT Water Supply (Meter3) Yesterday' column."
    );
  }

  // Build working dataset
  interface WorkRow {
    schemeId: string | null;
    schemeName: string | null;
    demand: number | null;
    yestProd: number | null;
    todayProd: number | null;
    pct: number | null;
    lastDate: string | null;
  }

  const work: WorkRow[] = rows.map((r) => {
    const demand = toNum(r[dailyDemandCol]);
    const yest = toNum(r[yestProdCol!]);
    const today = toNum(r[todayProdCol]);
    const pct =
      demand !== null && demand > 0 && yest !== null
        ? (yest / demand) * 100
        : null;
    return {
      schemeId: safeStr(r[schemeIdCol]),
      schemeName: safeStr(r[schemeNameCol]),
      demand,
      yestProd: yest,
      todayProd: today,
      pct,
      lastDate: safeStr(r[lastDateCol]),
    };
  });

  // Less than threshold
  let lessCounter = 1;
  const lessRows: LessRow[] = work
    .filter((w) => {
      const p = w.pct ?? 0;
      return p < threshold;
    })
    .map((w) => ({
      "SR.No.": lessCounter++,
      "Scheme Id": w.schemeId,
      "Scheme Name": w.schemeName,
      "Daily Water Demand (m^3)": w.demand,
      "Yesterday Water Production (m^3)": w.yestProd,
      Percentage: w.pct,
      "Supplied Water Percentage": `<${threshold}%`,
    }));

  // Valid scheme mask
  function isValidScheme(w: WorkRow): boolean {
    return (
      w.schemeId !== null &&
      w.schemeName !== null &&
      w.schemeId !== "" &&
      w.schemeName !== ""
    );
  }

  // Zero/Inactive: both yesterday and today are 0 (not both null)
  let zeroCounter = 1;
  const zeroRows: ZeroRow[] = work
    .filter((w) => {
      if (!isValidScheme(w)) return false;
      const bothNull = w.yestProd === null && w.todayProd === null;
      if (bothNull) return false;
      return (w.yestProd ?? 0) === 0 && (w.todayProd ?? 0) === 0;
    })
    .map((w) => ({
      "SR.No.": zeroCounter++,
      "Scheme Id": w.schemeId,
      "Scheme Name": w.schemeName,
      "Yesterday Water Production (m^3)": w.yestProd,
      "Today Water Production (m^3)": w.todayProd,
      "Last Data Receive Date": w.lastDate,
      "Site Status": "ZERO/INACTIVE SITE",
    }));

  // Today zero: today production = 0
  let todayZeroCounter = 1;
  const todayZeroRows: TodayZeroRow[] = work
    .filter((w) => {
      if (!isValidScheme(w)) return false;
      return (w.todayProd ?? 0) === 0;
    })
    .map((w) => ({
      "SR.No.": todayZeroCounter++,
      "Scheme Id": w.schemeId,
      "Scheme Name": w.schemeName,
      "Today Water Production (m^3)": w.todayProd,
      "Last Data Receive Date": w.lastDate,
      "Site Status": "ZERO/INACTIVE SITE",
    }));

  return { lessRows, zeroRows, todayZeroRows };
}

// ---------------------------------------------------------------------------
// Build Abnormal Sites
// ---------------------------------------------------------------------------
export function buildAbnormalSites(rows: SchemeRow[]): AbnormalRow[] {
  if (!rows.length) return [];

  const normMap = buildNormMap(rows[0]);
  const keys = Object.keys(rows[0]);

  const snoCol = keys[0];
  const schemeIdCol = findCol(normMap, "schemeid");
  const schemeNameCol = findCol(normMap, "schemename");
  const pumpStatusCol = findCol(normMap, "pumpstatus");
  const hydroCol = findCol(normMap, "groundwaterdepth", "avg", "meter");
  const chlorineCol = findCol(normMap, "chlorine", "ppm");
  const pressureCol = findCol(normMap, "pressure", "bar");
  const turbidityCol = findCol(normMap, "turbidity", "ntu");
  const voltageCol = findCol(normMap, "voltagern");
  const todayProdCol = findCol(normMap, "today", "waterproduction", "meter3");
  const overallProdCol = findCol(normMap, "overallproductionwater", "meter3");

  let yestSupplyCol: string | null = null;
  for (const [orig, norm] of Object.entries(normMap)) {
    if (
      norm.includes("oht") &&
      norm.includes("watersupply") &&
      norm.includes("meter3") &&
      norm.includes("yesterday")
    ) {
      yestSupplyCol = orig;
      break;
    }
  }
  if (!yestSupplyCol) throw new Error("Could not find OHT Water Supply yesterday column.");

  let lpcdWeeklyCol: string | null = null;
  for (const [orig, norm] of Object.entries(normMap)) {
    if ((norm.includes("avglpcd") || norm.includes("lpcd")) && norm.includes("weekly")) {
      lpcdWeeklyCol = orig;
      break;
    }
  }
  if (!lpcdWeeklyCol) throw new Error("Could not find weekly LPCD column.");

  let radarCol: string | null = null;
  for (const [orig, norm] of Object.entries(normMap)) {
    if (norm.includes("ohtlevel") && norm.includes("valueinm")) {
      radarCol = orig;
      break;
    }
  }
  if (!radarCol) throw new Error("Could not find OHT Level (Value in M) column.");

  const result: AbnormalRow[] = [];

  for (const r of rows) {
    const hydro = toNum(r[hydroCol]);
    const chlorine = toNum(r[chlorineCol]);
    const radar = toNum(r[radarCol]);
    const pressure = toNum(r[pressureCol]);
    const turbidity = toNum(r[turbidityCol]);
    const voltage = toNum(r[voltageCol]);
    const lpcd = toNum(r[lpcdWeeklyCol]);
    const totalizer = toNum(r[overallProdCol]);
    const todayProd = toNum(r[todayProdCol]);
    const yestSupply = toNum(r[yestSupplyCol!]);
    const pump = toStr(r[pumpStatusCol]).toUpperCase();

    // Abnormality checks
    const hydroAbnormal =
      hydro !== null && !(hydro >= 15 && hydro <= 22.5);
    const chlorineAbnormal =
      chlorine !== null && !(chlorine >= 0.15 && chlorine <= 0.5);
    const radarAbnormal =
      radar !== null && !(radar > 0 && radar <= 5.5);
    const turbidityAbnormal =
      turbidity !== null && !(turbidity > 0 && turbidity <= 5);
    const voltageAbnormal =
      voltage !== null && (voltage <= 0 || voltage < 215 || voltage > 240);
    const lpcdAbnormal = lpcd !== null && lpcd < 55;

    let pressureAbnormal = false;
    if (pressure !== null) {
      if (pump === "ON") {
        pressureAbnormal = !(pressure >= 1.45 && pressure <= 1.95);
      } else if (pump === "OFF") {
        pressureAbnormal = pressure !== 0;
      } else {
        pressureAbnormal = true;
      }
    }

    const totalizerAbnormal =
      totalizer !== null &&
      todayProd !== null &&
      yestSupply !== null &&
      todayProd === 0 &&
      yestSupply === 0;

    // If any abnormal
    if (
      hydroAbnormal ||
      chlorineAbnormal ||
      radarAbnormal ||
      pressureAbnormal ||
      turbidityAbnormal ||
      voltageAbnormal ||
      lpcdAbnormal ||
      totalizerAbnormal
    ) {
      result.push({
        "Sr.no": r[snoCol] ?? null,
        "Scheme Id": safeStr(r[schemeIdCol]),
        "Scheme Name": safeStr(r[schemeNameCol]),
        "Abnormal Hydrostatic Level": hydroAbnormal ? hydro : null,
        "Chlorine(PPM)": chlorineAbnormal ? chlorine : null,
        "Abnormal Radar Level": radarAbnormal ? radar : null,
        "Abnormal Pressure(BAR) Reading": pressureAbnormal ? pressure : null,
        "Abnormal Turbidity (NTU)": turbidityAbnormal ? turbidity : null,
        "Abnormal Voltage": voltageAbnormal ? voltage : null,
        "Abnormal LPCD": lpcdAbnormal ? lpcd : null,
        "Static Totalizer": totalizerAbnormal ? totalizer : null,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Build Critical Sites from Abnormal Sites
// ---------------------------------------------------------------------------
export function buildCriticalSites(abnormalRows: AbnormalRow[]): CriticalRow[] {
  if (!abnormalRows.length) return [];

  const kpiKeys: (keyof AbnormalRow)[] = [
    "Static Totalizer",
    "Abnormal Hydrostatic Level",
    "Chlorine(PPM)",
    "Abnormal Radar Level",
    "Abnormal Pressure(BAR) Reading",
    "Abnormal Turbidity (NTU)",
    "Abnormal Voltage",
    "Abnormal LPCD",
  ];

  const rows = abnormalRows.map((r) => {
    const count = kpiKeys.filter((k) => r[k] !== null && r[k] !== undefined).length;
    let severity: "HIGH" | "MEDIUM" | "LOW";
    if (count >= 6) severity = "HIGH";
    else if (count >= 3) severity = "MEDIUM";
    else severity = "LOW";
    return {
      "Sr.no": r["Sr.no"],
      "Scheme Id": r["Scheme Id"],
      "Scheme Name": r["Scheme Name"],
      "Abnormality Count": count,
      "Severity Score": severity,
    } as CriticalRow;
  });

  const sevRank: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
  return rows.sort((a, b) => {
    const ra = sevRank[a["Severity Score"]] ?? 4;
    const rb = sevRank[b["Severity Score"]] ?? 4;
    if (ra !== rb) return ra - rb;
    return b["Abnormality Count"] - a["Abnormality Count"];
  });
}

// ---------------------------------------------------------------------------
// Summary builders
// ---------------------------------------------------------------------------
function safeMean(vals: (number | null)[]): number {
  const nums = vals.filter((v): v is number => v !== null);
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function safeMin(vals: (number | null)[]): number {
  const nums = vals.filter((v): v is number => v !== null);
  if (!nums.length) return 0;
  return Math.round(Math.min(...nums) * 10) / 10;
}

export function buildSiteStatusSummary(
  lpcdRows: LpcdRow[],
  lessRows: LessRow[],
  zeroRows: ZeroRow[],
  todayZeroRows: TodayZeroRow[],
  abnormalRows: AbnormalRow[],
  threshold: number
): SummaryCount[] {
  function makeKey(id: string | null, name: string | null): string {
    return `${(id ?? "").trim()} | ${(name ?? "").trim()}`;
  }

  const zeroKeys = new Set(
    zeroRows.map((r) => makeKey(r["Scheme Id"], r["Scheme Name"]))
  );
  const todayZeroKeys = new Set(
    todayZeroRows.map((r) => makeKey(r["Scheme Id"], r["Scheme Name"]))
  );
  const lessKeys = new Set(
    lessRows.map((r) => makeKey(r["Scheme Id"], r["Scheme Name"]))
  );
  const abnormalKeys = new Set(
    abnormalRows.map((r) => makeKey(r["Scheme Id"], r["Scheme Name"]))
  );

  const counts: Record<string, number> = {};

  const seen = new Set<string>();
  for (const r of lpcdRows) {
    const key = makeKey(r["Scheme Id"], r["Scheme Name"]);
    if (!r["Scheme Id"] || !r["Scheme Name"] || seen.has(key)) continue;
    seen.add(key);

    let status: string;
    if (zeroKeys.has(key)) status = "Zero / Inactive";
    else if (todayZeroKeys.has(key)) status = "Today Zero";
    else if (lessKeys.has(key)) status = `Supply < ${threshold}%`;
    else if (abnormalKeys.has(key)) status = "Abnormal Reading";
    else status = "Healthy / Normal";

    counts[status] = (counts[status] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([Status, Count]) => ({ Status, Count }))
    .sort((a, b) => b.Count - a.Count);
}

export function buildSupplySeveritySummary(
  lessRows: LessRow[],
  threshold: number
): SeveritySummary[] {
  if (!lessRows.length) return [];

  function bucket(p: number | null): string {
    if (p === null) return "Unknown";
    if (p < 25) return "<25%";
    if (p < 50) return "25-50%";
    if (p < threshold) return `50-${threshold}%`;
    return `>=${threshold}%`;
  }

  const counts: Record<string, number> = {};
  for (const r of lessRows) {
    const b = bucket(r.Percentage);
    counts[b] = (counts[b] ?? 0) + 1;
  }

  const order = ["<25%", "25-50%", `50-${threshold}%`, `>=${threshold}%`, "Unknown"];
  return Object.entries(counts)
    .map(([Severity, Count]) => ({ Severity, Count }))
    .sort((a, b) => {
      const ia = order.indexOf(a.Severity);
      const ib = order.indexOf(b.Severity);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
}

export function buildAbnormalParamSummary(
  abnormalRows: AbnormalRow[]
): AbnormalParamSummary[] {
  if (!abnormalRows.length) return [];

  const params: { label: string; key: keyof AbnormalRow }[] = [
    { label: "Hydrostatic", key: "Abnormal Hydrostatic Level" },
    { label: "Chlorine", key: "Chlorine(PPM)" },
    { label: "Radar Level", key: "Abnormal Radar Level" },
    { label: "Pressure", key: "Abnormal Pressure(BAR) Reading" },
    { label: "Turbidity", key: "Abnormal Turbidity (NTU)" },
    { label: "Voltage", key: "Abnormal Voltage" },
    { label: "Weekly LPCD", key: "Abnormal LPCD" },
    { label: "Static Totalizer", key: "Static Totalizer" },
  ];

  return params
    .map(({ label, key }) => ({
      Parameter: label,
      Count: abnormalRows.filter((r) => r[key] !== null && r[key] !== undefined).length,
    }))
    .filter((p) => p.Count > 0);
}

export function buildCriticalSummary(
  criticalRows: CriticalRow[]
): SeveritySummary[] {
  if (!criticalRows.length) return [];
  const counts: Record<string, number> = {};
  for (const r of criticalRows) {
    counts[r["Severity Score"]] = (counts[r["Severity Score"]] ?? 0) + 1;
  }
  const sevRank: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
  return Object.entries(counts)
    .map(([Severity, Count]) => ({ Severity, Count }))
    .sort((a, b) => (sevRank[a.Severity] ?? 4) - (sevRank[b.Severity] ?? 4));
}

// ---------------------------------------------------------------------------
// Master process function
// ---------------------------------------------------------------------------
export function processReport(
  buffer: ArrayBuffer,
  threshold = 75
): ReportResult {
  const rows = parseExcel(buffer);
  if (!rows.length) throw new Error("No data rows found in the uploaded file.");

  const lpcdRows = buildLpcdStatus(rows);
  const { lessRows, zeroRows, todayZeroRows } = buildReport(rows, threshold);
  const abnormalRows = buildAbnormalSites(rows);
  const criticalRows = buildCriticalSites(abnormalRows);
  const statusSummary = buildSiteStatusSummary(lpcdRows, lessRows, zeroRows, todayZeroRows, abnormalRows, threshold);
  const severitySummary = buildSupplySeveritySummary(lessRows, threshold);
  const abnormalParamSummary = buildAbnormalParamSummary(abnormalRows);
  const criticalSummary = buildCriticalSummary(criticalRows);

  const avgYesterdayLpcd = safeMean(lpcdRows.map((r) => r["Avg LPCD (Yesterday)"]));
  const avgWeeklyLpcd = safeMean(lpcdRows.map((r) => r["Avg LPCD (Weekly)"]));
  const avgMonthlyLpcd = safeMean(lpcdRows.map((r) => r["Avg LPCD (Monthly)"]));
  const lowestSupplyPct = safeMin(lessRows.map((r) => r.Percentage));

  return {
    lessRows,
    zeroRows,
    todayZeroRows,
    lpcdRows,
    abnormalRows,
    criticalRows,
    statusSummary,
    severitySummary,
    abnormalParamSummary,
    criticalSummary,
    threshold,
    totalSchemes: lpcdRows.length,
    avgYesterdayLpcd,
    avgWeeklyLpcd,
    avgMonthlyLpcd,
    lowestSupplyPct,
  };
}

// ---------------------------------------------------------------------------
// Excel export — styled to match the Streamlit/openpyxl output exactly
// ---------------------------------------------------------------------------

const HEADER_FILL = { fgColor: { rgb: "5B9BD5" } };
const HEADER_FONT = { bold: true, color: { rgb: "000000" } };
const ABNORMAL_FILL = { fgColor: { rgb: "FFC7CE" } };
const AVG_FILL = { fgColor: { rgb: "E2F0D9" } };
const NOTE_LABEL_FILL = { fgColor: { rgb: "D9EAF7" } };
const NOTE_VALUE_FILL = { fgColor: { rgb: "FFF2CC" } };
const BOLD_FONT = { bold: true, color: { rgb: "000000" } };
const THIN_BORDER = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
} as const;
const ALIGN_CENTER = { horizontal: "center" as const, vertical: "center" as const };
const ALIGN_LEFT = { horizontal: "left" as const, vertical: "center" as const };

function applyHeaderStyle(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (!cell) continue;
    cell.s = {
      fill: HEADER_FILL,
      font: HEADER_FONT,
      alignment: ALIGN_CENTER,
      border: THIN_BORDER,
    };
  }
}

function applyBordersAndAlignment(ws: XLSX.WorkSheet, schemeNameColIdx = 2) {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let r = 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      cell.s = {
        ...(cell.s || {}),
        border: THIN_BORDER,
        alignment: c === schemeNameColIdx ? ALIGN_LEFT : ALIGN_CENTER,
      };
    }
  }
}

function autoWidth(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  const colWidths: number[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    let maxLen = 10;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v != null) {
        maxLen = Math.max(maxLen, String(cell.v).length);
      }
    }
    colWidths.push(Math.min(60, Math.max(10, maxLen * 1.2 + 2)));
  }
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));
}

function formatSheet(ws: XLSX.WorkSheet, schemeNameColIdx = 2) {
  applyHeaderStyle(ws);
  applyBordersAndAlignment(ws, schemeNameColIdx);
  autoWidth(ws);
}

export function generateExcelReport(result: ReportResult): Blob {
  const wb = XLSX.utils.book_new();

  // ── LPCD STATUS ──
  {
    const ws = XLSX.utils.json_to_sheet(result.lpcdRows);
    formatSheet(ws, 2);

    // Add average row at the bottom
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    const avgRow = range.e.r + 1;

    // Column C (idx 2) = "Average" label
    const labelAddr = XLSX.utils.encode_cell({ r: avgRow, c: 2 });
    ws[labelAddr] = {
      v: "Average", t: "s",
      s: { font: BOLD_FONT, fill: AVG_FILL, alignment: ALIGN_LEFT, border: THIN_BORDER },
    };

    // Columns D, E, F (idx 3,4,5) = averages of numeric data
    for (const colIdx of [3, 4, 5]) {
      const vals: number[] = [];
      for (let r = 1; r <= range.e.r; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: colIdx })];
        if (cell && cell.v != null) {
          const n = Number(cell.v);
          if (!isNaN(n)) vals.push(n);
        }
      }
      const avg = vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
        : null;
      const addr = XLSX.utils.encode_cell({ r: avgRow, c: colIdx });
      ws[addr] = {
        v: avg, t: avg !== null ? "n" : "s", z: "0.00",
        s: { font: BOLD_FONT, fill: AVG_FILL, alignment: ALIGN_CENTER, border: THIN_BORDER },
      };
    }

    // Style remaining avg row cells
    for (let c = 0; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: avgRow, c });
      if (!ws[addr]) {
        ws[addr] = {
          v: "", t: "s",
          s: { font: BOLD_FONT, fill: AVG_FILL, border: THIN_BORDER, alignment: ALIGN_CENTER },
        };
      }
    }

    // Update range
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: avgRow, c: range.e.c } });
    autoWidth(ws);
    XLSX.utils.book_append_sheet(wb, ws, "LPCD STATUS");
  }

  // ── SUPPLIED WATER LESS THAN 75 ──
  {
    const ws = XLSX.utils.json_to_sheet(result.lessRows);
    formatSheet(ws, 2);
    XLSX.utils.book_append_sheet(wb, ws, "SUPPLIED WATER LESS THAN 75");
  }

  // ── ZERO(INACTIVE SITES) ──
  {
    const ws = XLSX.utils.json_to_sheet(result.zeroRows);
    formatSheet(ws, 2);
    XLSX.utils.book_append_sheet(wb, ws, "ZERO(INACTIVE SITES)");
  }

  // ── TODAY ZERO SITES ──
  {
    const ws = XLSX.utils.json_to_sheet(result.todayZeroRows);
    formatSheet(ws, 2);
    XLSX.utils.book_append_sheet(wb, ws, "TODAY ZERO SITES");
  }

  // ── ABNORMAL SITES ──
  {
    const ws = XLSX.utils.json_to_sheet(result.abnormalRows);
    formatSheet(ws, 2);

    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");

    // Highlight abnormal value cells (columns D onward, idx >= 3) with light red
    for (let r = 1; r <= range.e.r; r++) {
      for (let c = 3; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell && cell.v != null && cell.v !== "") {
          cell.s = {
            ...(cell.s || {}),
            fill: ABNORMAL_FILL,
            font: BOLD_FONT,
            border: THIN_BORDER,
          };
        }
      }
    }

    // Add normal-range reference notes below data
    const notes: [string, string][] = [
      ["Normal Hydrostatic Level", "15 to 22.5"],
      ["Normal Chlorine(PPM)", "0.15 to 0.5"],
      ["Normal Radar Level", "0+ to 5.5"],
      ["Normal Pressure(BAR)", "1.45 to 1.95"],
      ["Normal Turbidity(NTU)", "0+ to 5"],
      ["Normal Voltage", "215 to 240"],
      ["Normal LPCD", ">=55"],
    ];

    const startRow = range.e.r + 2;
    for (let i = 0; i < notes.length; i++) {
      const r = startRow + i;
      const labelAddr = XLSX.utils.encode_cell({ r, c: 0 });
      const valueAddr = XLSX.utils.encode_cell({ r, c: 1 });
      ws[labelAddr] = {
        v: notes[i][0], t: "s",
        s: { font: BOLD_FONT, fill: NOTE_LABEL_FILL, alignment: ALIGN_LEFT, border: THIN_BORDER },
      };
      ws[valueAddr] = {
        v: notes[i][1], t: "s",
        s: { font: BOLD_FONT, fill: NOTE_VALUE_FILL, alignment: ALIGN_CENTER, border: THIN_BORDER },
      };
    }

    // Update range and column widths
    const newEnd = startRow + notes.length - 1;
    ws["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: newEnd, c: range.e.c },
    });

    autoWidth(ws);
    // Ensure col A and B are wide enough for notes
    if (ws["!cols"]) {
      ws["!cols"][0] = { wch: Math.max(ws["!cols"][0]?.wch ?? 10, 34) };
      ws["!cols"][1] = { wch: Math.max(ws["!cols"][1]?.wch ?? 10, 42) };
    }

    XLSX.utils.book_append_sheet(wb, ws, "ABNORMAL SITES");
  }

  // ── CRITICAL SITES ──
  {
    const ws = XLSX.utils.json_to_sheet(result.criticalRows);
    formatSheet(ws, 2);
    XLSX.utils.book_append_sheet(wb, ws, "CRITICAL SITES");
  }

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
