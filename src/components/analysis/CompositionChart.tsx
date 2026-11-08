import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { COMPOSITION_COLOR, type CompositionSlice } from "./analysis-shared";

const PALETTE = ["#ef4444", "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4"];

function getSliceColor(category: string, index: number): string {
  return COMPOSITION_COLOR[category] || PALETTE[index % PALETTE.length];
}

export function CompositionChart({ data }: { data: CompositionSlice[] }) {
  const slices = data.filter((d) => d.percent > 0);
  if (slices.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No content composition data available yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="percent"
              nameKey="category"
              innerRadius={45}
              outerRadius={78}
              paddingAngle={2}
            >
              {slices.map((s, idx) => (
                <Cell key={s.category} fill={getSliceColor(s.category, idx)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, n: string) => [`${v}%`, n]}
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {slices.map((s, idx) => (
          <div key={s.category}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{s.category}</span>
              <span className="font-semibold text-foreground">
                {s.percent}% · {s.words} words
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, s.percent)}%`,
                  background: getSliceColor(s.category, idx),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
