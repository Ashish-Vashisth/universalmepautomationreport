"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SummaryCards } from "@/components/summary-cards";
import { MetricCard } from "@/components/summary-cards";
import { DonutChart, SimpleBarChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import type { ReportResult } from "@/types";

interface DashboardProps {
  result: ReportResult;
}

const tabVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h3 className="text-slate-700 dark:text-white font-semibold text-sm uppercase tracking-wide">
        {children}
      </h3>
      <Separator className="flex-1 bg-slate-200 dark:bg-white/10" />
    </div>
  );
}

export function Dashboard({ result }: DashboardProps) {
  const {
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
    totalSchemes,
    avgYesterdayLpcd,
    avgWeeklyLpcd,
    avgMonthlyLpcd,
    lowestSupplyPct,
  } = result;

  // Chart data shapes
  const statusChartData = statusSummary.map((s) => ({
    name: s.Status,
    value: s.Count,
  }));
  const severityChartData = severitySummary.map((s) => ({
    name: s.Severity,
    value: s.Count,
  }));
  const abnormalParamChartData = abnormalParamSummary.map((s) => ({
    name: s.Parameter,
    value: s.Count,
  }));
  const criticalChartData = criticalSummary.map((s) => ({
    name: s.Severity,
    value: s.Count,
  }));

  // Top-10 lowest LPCD weekly
  const top10Lpcd = [...lpcdRows]
    .filter((r) => r["Avg LPCD (Weekly)"] !== null)
    .sort((a, b) => (a["Avg LPCD (Weekly)"] ?? 0) - (b["Avg LPCD (Weekly)"] ?? 0))
    .slice(0, 10)
    .map((r) => ({ name: r["Scheme Name"] ?? "Unknown", value: r["Avg LPCD (Weekly)"] ?? 0 }));

  // Top-10 worst supply %
  const worst10Supply = [...lessRows]
    .filter((r) => r.Percentage !== null)
    .sort((a, b) => (a.Percentage ?? 0) - (b.Percentage ?? 0))
    .slice(0, 10)
    .map((r) => ({ name: r["Scheme Name"] ?? "Unknown", value: Math.round(r.Percentage ?? 0) }));

  // High/medium/low counts for critical tab
  const highCrit = criticalRows.filter((r) => r["Severity Score"] === "HIGH").length;
  const medCrit = criticalRows.filter((r) => r["Severity Score"] === "MEDIUM").length;
  const lowCrit = criticalRows.filter((r) => r["Severity Score"] === "LOW").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-5"
    >
      {/* Quick top-level metrics */}
      <SummaryCards
        totalSchemes={totalSchemes}
        threshold={threshold}
        lessCount={lessRows.length}
        zeroCount={zeroRows.length}
        todayZeroCount={todayZeroRows.length}
        abnormalCount={abnormalRows.length}
      />

      {/* Tabs */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="w-full flex flex-wrap gap-1 h-auto bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1 rounded-xl mb-2">
          {[
            { value: "summary", label: "Summary" },
            { value: "lpcd", label: "LPCD Status" },
            { value: "supply", label: `Supply < ${threshold}%` },
            { value: "zero", label: "Zero / Inactive" },
            { value: "abnormal", label: "Abnormal Sites" },
            { value: "critical", label: "Critical Sites" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-1 text-xs sm:text-sm text-slate-500 dark:text-white/50 data-[state=active]:bg-[#ff4b4b] data-[state=active]:text-white data-[state=active]:shadow-none rounded-lg py-2 px-3 transition-all"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── TAB: SUMMARY ─────────────────────────────── */}
        <TabsContent value="summary">
          <AnimatePresence mode="wait">
            <motion.div
              key="summary"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <SectionHeader>Site Status Distribution</SectionHeader>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1 glass-card p-4">
                  <DonutChart data={statusChartData} title="Status Distribution" />
                </div>
                <div className="lg:col-span-1 glass-card p-4">
                  <DonutChart data={severityChartData} title="Supply Severity Levels" />
                </div>
                <div className="lg:col-span-1 glass-card p-4">
                  <DonutChart data={abnormalParamChartData} title="Abnormal Parameters" />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* ── TAB: LPCD ─────────────────────────────────── */}
        <TabsContent value="lpcd">
          <AnimatePresence mode="wait">
            <motion.div
              key="lpcd"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <SectionHeader>LPCD Status Overview</SectionHeader>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MetricCard
                  label="Avg Yesterday LPCD"
                  value={avgYesterdayLpcd}
                  color="blue"
                  index={0}
                />
                <MetricCard
                  label="Avg Weekly LPCD"
                  value={avgWeeklyLpcd}
                  color="green"
                  index={1}
                />
                <MetricCard
                  label="Avg Monthly LPCD"
                  value={avgMonthlyLpcd}
                  color="orange"
                  index={2}
                />
              </div>

              <div className="glass-card p-5">
                <SectionHeader>Lowest LPCD Weekly (Top 10)</SectionHeader>
                <SimpleBarChart
                  data={top10Lpcd}
                  color="#4FC3F7"
                  valueLabel="LPCD"
                  height={360}
                />
              </div>

              <div className="glass-card p-5">
                <DataTable data={lpcdRows} title="Full LPCD Data" />
              </div>
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* ── TAB: SUPPLY < THRESHOLD ───────────────────── */}
        <TabsContent value="supply">
          <AnimatePresence mode="wait">
            <motion.div
              key="supply"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <SectionHeader>Sites Supplied Below {threshold}% Threshold</SectionHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MetricCard
                  label="Below Threshold Sites"
                  value={lessRows.length}
                  color="yellow"
                  index={0}
                />
                <MetricCard
                  label="Lowest Supply %"
                  value={`${lowestSupplyPct}%`}
                  color="red"
                  index={1}
                />
              </div>

              <div className="glass-card p-5">
                <SectionHeader>Worst Supply % (Top 10)</SectionHeader>
                <SimpleBarChart
                  data={worst10Supply}
                  color="#ff4b4b"
                  valueLabel="Supply %"
                  height={360}
                />
              </div>

              <div className="glass-card p-5">
                <DataTable data={lessRows} title="All Below-Threshold Sites" />
              </div>
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* ── TAB: ZERO / INACTIVE ─────────────────────── */}
        <TabsContent value="zero">
          <AnimatePresence mode="wait">
            <motion.div
              key="zero"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <SectionHeader>Zero / Inactive Sites</SectionHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MetricCard
                  label="Total Inactive Sites"
                  value={zeroRows.length}
                  color="red"
                  index={0}
                />
                <MetricCard
                  label="Today Zero Sites"
                  value={todayZeroRows.length}
                  color="orange"
                  index={1}
                />
              </div>

              <div className="glass-card p-5">
                <SectionHeader>Zero / Inactive (Both Days)</SectionHeader>
                <DataTable data={zeroRows} />
              </div>

              <div className="glass-card p-5">
                <SectionHeader>Today Zero Sites</SectionHeader>
                <DataTable data={todayZeroRows} />
              </div>
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* ── TAB: ABNORMAL ────────────────────────────── */}
        <TabsContent value="abnormal">
          <AnimatePresence mode="wait">
            <motion.div
              key="abnormal"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <SectionHeader>Abnormal Instrument Readings</SectionHeader>

              <MetricCard
                label="Total Abnormal Sites"
                value={abnormalRows.length}
                color="red"
                index={0}
              />

              <div className="glass-card p-5">
                <SectionHeader>Abnormal Parameter Breakdown</SectionHeader>
                <SimpleBarChart
                  data={abnormalParamChartData}
                  color="#CE93D8"
                  valueLabel="Sites"
                  height={300}
                />
              </div>

              {/* Normal-range notes */}
              <div className="glass-card p-5">
                <SectionHeader>Normal Ranges Reference</SectionHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {[
                    ["Hydrostatic Level", "15 – 22.5"],
                    ["Chlorine (PPM)", "0.15 – 0.5"],
                    ["Radar Level", "0+ – 5.5"],
                    ["Pressure (BAR) [Pump ON]", "1.45 – 1.95"],
                    ["Turbidity (NTU)", "0+ – 5"],
                    ["Voltage (V)", "215 – 240"],
                    ["Weekly LPCD", "≥ 55"],
                  ].map(([param, range]) => (
                    <div
                      key={param}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2.5"
                    >
                      <span className="text-slate-600 dark:text-white/60 text-xs">{param}</span>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-green-500/15 text-green-400 border-green-500/20"
                      >
                        {range}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-5">
                <DataTable data={abnormalRows} title="Abnormal Sites Data" />
              </div>
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* ── TAB: CRITICAL ────────────────────────────── */}
        <TabsContent value="critical">
          <AnimatePresence mode="wait">
            <motion.div
              key="critical"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <SectionHeader>Critical Sites (by Abnormality Count)</SectionHeader>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="Total Critical" value={criticalRows.length} color="red" index={0} />
                <MetricCard label="HIGH Severity" value={highCrit} color="red" index={1} />
                <MetricCard label="MEDIUM Severity" value={medCrit} color="yellow" index={2} />
                <MetricCard label="LOW Severity" value={lowCrit} color="green" index={3} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="glass-card p-5">
                  <SectionHeader>Severity Distribution</SectionHeader>
                  <DonutChart data={criticalChartData} />
                </div>
                <div className="glass-card p-5">
                  <SectionHeader>Severity Bar Chart</SectionHeader>
                  <SimpleBarChart
                    data={criticalChartData}
                    color="#ff4b4b"
                    valueLabel="Sites"
                    height={280}
                  />
                </div>
              </div>

              <div className="glass-card p-5">
                <DataTable data={criticalRows} title="Detailed Critical Sites" />
              </div>
            </motion.div>
          </AnimatePresence>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
