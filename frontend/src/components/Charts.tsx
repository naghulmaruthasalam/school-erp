import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* Chart colours come from the design tokens so they follow theme + role accent. */
const ACCENT = "var(--accent)";
const ACCENT_2 = "var(--accent-2)";
const GRID = "var(--line)";
const AXIS = "var(--ink-3)";

const COLORS = ["var(--accent)", "#30c25a", "#ff9f0a", "#ff4f8b", "var(--accent-2)", "#32ade6"];

const axisProps = {
  tick: { fontSize: 11.5, fill: AXIS },
  stroke: "transparent",
  tickLine: false,
} as const;

const tooltipProps = {
  cursor: { stroke: "var(--line-strong)", strokeDasharray: "4 4", fill: "var(--accent-soft)" },
  contentStyle: {
    borderRadius: 16,
    border: "1px solid var(--line)",
    background: "var(--surface-solid)",
    boxShadow: "0 18px 40px -16px rgba(20,30,70,0.45)",
    color: "var(--ink)",
    fontSize: 12.5,
    padding: "8px 12px",
  },
  labelStyle: { color: "var(--ink-3)", marginBottom: 2, fontWeight: 600 },
  itemStyle: { color: "var(--ink)" },
} as const;

const grid = <CartesianGrid strokeDasharray="2 6" stroke={GRID} vertical={false} />;

interface ChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  height?: number;
}

export function AttendanceLineChart({ data, height = 250 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="lgLineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.32} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        {grid}
        <XAxis dataKey="date" {...axisProps} />
        <YAxis {...axisProps} domain={[0, 100]} />
        <Tooltip {...tooltipProps} />
        <Area
          type="monotone"
          dataKey="percentage"
          stroke={ACCENT}
          strokeWidth={2.5}
          fill="url(#lgLineFill)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--surface-solid)", fill: ACCENT }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FeeCollectionBarChart({ data, height = 250 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -4 }} barCategoryGap="28%">
        <defs>
          <linearGradient id="lgBarFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={1} />
            <stop offset="100%" stopColor={ACCENT_2} stopOpacity={0.55} />
          </linearGradient>
        </defs>
        {grid}
        <XAxis dataKey="month" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip
          {...tooltipProps}
          formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Collected"]}
        />
        <Bar dataKey="amount" fill="url(#lgBarFill)" radius={[10, 10, 4, 4]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StudentDistributionPie({ data, height = 250 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={62}
          outerRadius={92}
          paddingAngle={3}
          cornerRadius={8}
          stroke="none"
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipProps} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function AttendanceAreaChart({ data, height = 250 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#30c25a" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#30c25a" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff453a" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#ff453a" stopOpacity={0} />
          </linearGradient>
        </defs>
        {grid}
        <XAxis dataKey="date" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip {...tooltipProps} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />
        <Area type="monotone" dataKey="present" stroke="#30c25a" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPresent)" />
        <Area type="monotone" dataKey="absent" stroke="#ff453a" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAbsent)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HomeworkCompletionChart({ data, height = 200 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 60 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="2 6" stroke={GRID} horizontal={false} />
        <XAxis type="number" {...axisProps} domain={[0, 100]} />
        <YAxis dataKey="subject" type="category" {...axisProps} />
        <Tooltip {...tooltipProps} formatter={(value) => [`${value}%`, "Completion"]} />
        <Bar dataKey="completion" fill={ACCENT} radius={[4, 10, 10, 4]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ClassFeeBarChart({ data, height = 250 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -4 }} barCategoryGap="28%">
        {grid}
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip {...tooltipProps} formatter={(value, name) => [`₹${Number(value).toLocaleString("en-IN")}`, name === "collected" ? "Collected" : "Pending"]} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} formatter={(v) => (v === "collected" ? "Collected" : "Pending")} />
        <Bar dataKey="collected" stackId="fees" fill="#30c25a" radius={[0, 0, 4, 4]} />
        <Bar dataKey="pending" stackId="fees" fill="#ff9f0a" radius={[10, 10, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
