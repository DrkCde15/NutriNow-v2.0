import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { WeightHistoryPoint } from "@/components/dashboard-models";

interface WeightTrendChartProps {
  data: WeightHistoryPoint[];
}

export function WeightTrendChart({ data }: WeightTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="left"
          stroke="var(--color-muted-foreground)"
          tickLine={false}
          axisLine={false}
          domain={["dataMin - 1", "dataMax + 1"]}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="var(--color-muted-foreground)"
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 18,
            border: "1px solid var(--color-border)",
            backgroundColor: "white",
            color: "var(--color-foreground)",
          }}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="weight"
          name="Peso"
          stroke="var(--color-primary)"
          strokeWidth={3}
          dot={{ r: 4, fill: "var(--color-primary)" }}
          activeDot={{ r: 6 }}
          connectNulls={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="activityLevel"
          name="Atividade"
          stroke="var(--color-accent-foreground)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-accent-foreground)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
