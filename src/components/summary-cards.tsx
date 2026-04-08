"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: number | string;
  sub?: string;
  color?: "default" | "red" | "yellow" | "green" | "blue" | "orange";
  index?: number;
}

const colorMap = {
  default: "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5",
  red: "border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10",
  yellow: "border-yellow-200 bg-yellow-50 dark:border-yellow-400/25 dark:bg-yellow-400/10",
  green: "border-green-200 bg-green-50 dark:border-green-500/25 dark:bg-green-500/10",
  blue: "border-blue-200 bg-blue-50 dark:border-blue-400/25 dark:bg-blue-400/10",
  orange: "border-orange-200 bg-orange-50 dark:border-orange-400/25 dark:bg-orange-400/10",
};

const valueColorMap = {
  default: "text-slate-800 dark:text-white",
  red: "text-red-600 dark:text-red-400",
  yellow: "text-amber-600 dark:text-yellow-300",
  green: "text-green-600 dark:text-green-400",
  blue: "text-blue-600 dark:text-blue-300",
  orange: "text-orange-600 dark:text-orange-300",
};

export function MetricCard({
  label,
  value,
  sub,
  color = "default",
  index = 0,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
      className={cn(
        "rounded-xl border px-5 py-4 flex flex-col gap-1 backdrop-blur-sm",
        colorMap[color]
      )}
    >
      <span className="text-slate-500 dark:text-white/50 text-xs font-medium uppercase tracking-wide leading-tight">
        {label}
      </span>
      <span className={cn("text-2xl font-bold leading-tight tabular-nums", valueColorMap[color])}>
        {value}
      </span>
      {sub && (
        <span className="text-slate-400 dark:text-white/40 text-xs leading-tight">{sub}</span>
      )}
    </motion.div>
  );
}

interface SummaryCardsProps {
  totalSchemes: number;
  threshold: number;
  lessCount: number;
  zeroCount: number;
  todayZeroCount: number;
  abnormalCount: number;
}

export function SummaryCards({
  totalSchemes,
  threshold,
  lessCount,
  zeroCount,
  todayZeroCount,
  abnormalCount,
}: SummaryCardsProps) {
  const cards = [
    { label: "Total Schemes", value: totalSchemes, color: "blue" as const },
    { label: `Supply < ${threshold}%`, value: lessCount, color: "yellow" as const },
    { label: "Zero / Inactive", value: zeroCount, color: "red" as const },
    { label: "Today Zero Sites", value: todayZeroCount, color: "orange" as const },
    { label: "Abnormal Sites", value: abnormalCount, color: "red" as const },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c, i) => (
        <MetricCard key={c.label} {...c} index={i} />
      ))}
    </div>
  );
}
