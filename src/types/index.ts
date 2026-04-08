// Types for JJM SWSM Daily Report Generator

export interface SchemeRow {
  [key: string]: string | number | null | undefined;
}

export interface LpcdRow {
  "Sno.": number | string | null;
  "Scheme Id": string | null;
  "Scheme Name": string | null;
  "Avg LPCD (Yesterday)": number | null;
  "Avg LPCD (Weekly)": number | null;
  "Avg LPCD (Monthly)": number | null;
}

export interface LessRow {
  "SR.No.": number;
  "Scheme Id": string | null;
  "Scheme Name": string | null;
  "Daily Water Demand (m^3)": number | null;
  "Yesterday Water Production (m^3)": number | null;
  Percentage: number | null;
  "Supplied Water Percentage": string;
}

export interface ZeroRow {
  "SR.No.": number;
  "Scheme Id": string | null;
  "Scheme Name": string | null;
  "Yesterday Water Production (m^3)": number | null;
  "Today Water Production (m^3)": number | null;
  "Last Data Receive Date": string | null;
  "Site Status": string;
}

export interface TodayZeroRow {
  "SR.No.": number;
  "Scheme Id": string | null;
  "Scheme Name": string | null;
  "Today Water Production (m^3)": number | null;
  "Last Data Receive Date": string | null;
  "Site Status": string;
}

export interface AbnormalRow {
  "Sr.no": number | string | null;
  "Scheme Id": string | null;
  "Scheme Name": string | null;
  "Abnormal Hydrostatic Level": number | null;
  "Chlorine(PPM)": number | null;
  "Abnormal Radar Level": number | null;
  "Abnormal Pressure(BAR) Reading": number | null;
  "Abnormal Turbidity (NTU)": number | null;
  "Abnormal Voltage": number | null;
  "Abnormal LPCD": number | null;
  "Static Totalizer": number | null;
}

export interface CriticalRow {
  "Sr.no": number | string | null;
  "Scheme Id": string | null;
  "Scheme Name": string | null;
  "Abnormality Count": number;
  "Severity Score": "HIGH" | "MEDIUM" | "LOW";
}

export interface SummaryCount {
  Status: string;
  Count: number;
}

export interface SeveritySummary {
  Severity: string;
  Count: number;
}

export interface AbnormalParamSummary {
  Parameter: string;
  Count: number;
}

export interface ReportResult {
  lessRows: LessRow[];
  zeroRows: ZeroRow[];
  todayZeroRows: TodayZeroRow[];
  lpcdRows: LpcdRow[];
  abnormalRows: AbnormalRow[];
  criticalRows: CriticalRow[];
  statusSummary: SummaryCount[];
  severitySummary: SeveritySummary[];
  abnormalParamSummary: AbnormalParamSummary[];
  criticalSummary: SeveritySummary[];
  threshold: number;
  totalSchemes: number;
  avgYesterdayLpcd: number;
  avgWeeklyLpcd: number;
  avgMonthlyLpcd: number;
  lowestSupplyPct: number;
}
