"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { stroke: "var(--muted-foreground)", fontSize: 12 };
const tooltipStyle = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" },
  cursor: { fill: "var(--accent)" },
};

export function ProgressDistributionChart({ data }: { data: { range: string; count: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label={`Students by progress: ${data.map((d) => `${d.range} ${d.count}`).join(", ")}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="range" {...axis} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="count" name="Students" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function QuizResultsChart({ data }: { data: { title: string; averageBest: number | null; passRate: number | null }[] }) {
  const rows = data.map((d) => ({ title: d.title, "Average best score": d.averageBest ?? 0, "Pass rate": d.passRate ?? 0 }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Average best score and pass rate per quiz">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="title" {...axis} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
          <YAxis domain={[0, 100]} unit="%" {...axis} />
          <Tooltip {...tooltipStyle} formatter={(v) => `${v}%`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Average best score" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Pass rate" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EnrollmentChart({ data }: { data: { title: string; enrolled: number; completed: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Enrollments and completions per course">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="title" {...axis} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="enrolled" name="Enrolled" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="completed" name="Completed" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
