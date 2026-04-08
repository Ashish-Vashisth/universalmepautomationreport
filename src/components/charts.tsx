"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
  type PieLabelRenderProps,
} from "recharts";
import { useTheme } from "next-themes";

// Color palettes
const DONUT_COLORS = [
  "#ff4b4b",
  "#4FC3F7",
  "#81C784",
  "#FFB74D",
  "#CE93D8",
  "#80DEEA",
  "#F48FB1",
  "#A5D6A7",
];

interface DonutChartProps {
  data: { name: string; value: number }[];
  title?: string;
  height?: number;
}

const RADIAN = Math.PI / 180;

/** Renders name + percentage INSIDE the slice (like the Streamlit/Plotly version) */
function renderInsideLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const percent = Number(props.percent ?? 0);
  const name = String(props.name ?? "");

  if (percent < 0.04) return null;

  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const pctText = `${(percent * 100).toFixed(percent >= 0.1 ? 0 : 1)}%`;

  // For small slices, just show percentage
  if (percent < 0.08) {
    return (
      <text
        x={x} y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fontWeight={700}
      >
        {pctText}
      </text>
    );
  }

  return (
    <g>
      <text
        x={x} y={y - 7}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
      >
        {name.length > 12 ? name.slice(0, 11) + "…" : name}
      </text>
      <text
        x={x} y={y + 8}
        fill="rgba(255,255,255,0.85)"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fontWeight={600}
      >
        {pctText}
      </text>
    </g>
  );
}

/** Glassmorphism custom tooltip */
function GlassTooltip({
  active,
  payload,
  total,
  isDark,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { fill?: string } }>;
  total: number;
  isDark: boolean;
}) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
  const dotColor = p?.fill ?? DONUT_COLORS[0];

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border shadow-xl
        ${isDark
          ? "bg-slate-900/80 border-white/15 text-white"
          : "bg-white/80 border-slate-200 text-slate-900"
        }
      `}
      style={{
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        minWidth: 160,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: dotColor }}
        />
        <span className="font-bold text-sm">{name}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className={`text-xs ${isDark ? "text-white/50" : "text-slate-500"}`}>Count</span>
        <span className="text-lg font-bold tabular-nums">{value}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className={`text-xs ${isDark ? "text-white/50" : "text-slate-500"}`}>Share</span>
        <span className="text-sm font-semibold tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

export function DonutChart({ data, title, height = 360 }: DonutChartProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const textColor = isDark ? "#e2e8f0" : "#1e293b";
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-400 dark:text-white/40 text-sm"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <div>
      {title && (
        <p className="text-slate-500 dark:text-white/60 text-sm font-medium mb-3 text-center">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="38%"
            outerRadius="72%"
            paddingAngle={1.5}
            dataKey="value"
            nameKey="name"
            label={renderInsideLabel}
            labelLine={false}
            isAnimationActive={true}
            animationDuration={600}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => (
              <GlassTooltip
                active={active}
                payload={payload as unknown as Array<{ name: string; value: number; payload: { fill?: string } }>}
                total={total}
                isDark={isDark}
              />
            )}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: textColor, paddingTop: 8 }}
            iconType="circle"
            iconSize={10}
            formatter={(value: string) => {
              const item = data.find((d) => d.name === value);
              return item ? `${value} (${item.value})` : value;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BarChartProps {
  data: { name: string; value: number }[];
  title?: string;
  color?: string;
  height?: number;
  valueLabel?: string;
}

export function SimpleBarChart({
  data,
  title,
  color = "#4FC3F7",
  height = 340,
  valueLabel = "Count",
}: BarChartProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const textColor = isDark ? "#94a3b8" : "#475569";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-400 dark:text-white/40 text-sm"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <div>
      {title && (
        <p className="text-slate-500 dark:text-white/60 text-sm font-medium mb-3">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: textColor, fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: textColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const { name } = payload[0].payload as { name: string };
              const val = payload[0].value;
              return (
                <div
                  className={`px-4 py-3 rounded-xl border shadow-xl ${
                    isDark
                      ? "bg-slate-900/80 border-white/15 text-white"
                      : "bg-white/80 border-slate-200 text-slate-900"
                  }`}
                  style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
                >
                  <p className="font-bold text-sm mb-1">{name}</p>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className={`text-xs ${isDark ? "text-white/50" : "text-slate-500"}`}>{valueLabel}</span>
                    <span className="text-lg font-bold tabular-nums">{val}</span>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="value"
              position="top"
              style={{ fill: textColor, fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
