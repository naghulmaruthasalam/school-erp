import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#8b5cf6", "#22c55e", "#f59e0b", "#ec4899", "#a78bfa", "#06b6d4"];

interface ChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  height?: number;
}

export function AttendanceLineChart({
  data,
  height = 250,
}: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#a78bfa" />
        <YAxis tick={{ fontSize: 12 }} stroke="#a78bfa" domain={[0, 100]} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e9d5ff", backgroundColor: "#faf5ff" }}
        />
        <Line
          type="monotone"
          dataKey="percentage"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ fill: "#8b5cf6", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FeeCollectionBarChart({ data, height = 250 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#a78bfa" />
        <YAxis tick={{ fontSize: 12 }} stroke="#a78bfa" />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e9d5ff", backgroundColor: "#faf5ff" }}
          formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Collected"]}
        />
        <Bar dataKey="amount" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StudentDistributionPie({
  data,
  height = 250,
}: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function AttendanceAreaChart({ data, height = 250 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <defs>
          <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#a78bfa" />
        <YAxis tick={{ fontSize: 12 }} stroke="#a78bfa" />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e9d5ff", backgroundColor: "#faf5ff" }} />
        <Legend />
        <Area
          type="monotone"
          dataKey="present"
          stroke="#22c55e"
          fillOpacity={1}
          fill="url(#colorPresent)"
        />
        <Area
          type="monotone"
          dataKey="absent"
          stroke="#ef4444"
          fillOpacity={1}
          fill="url(#colorAbsent)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HomeworkCompletionChart({ data, height = 200 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
        <XAxis type="number" tick={{ fontSize: 12 }} stroke="#a78bfa" domain={[0, 100]} />
        <YAxis dataKey="subject" type="category" tick={{ fontSize: 12 }} stroke="#a78bfa" />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e9d5ff", backgroundColor: "#faf5ff" }}
          formatter={(value) => [`${value}%`, "Completion"]}
        />
        <Bar dataKey="completion" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
