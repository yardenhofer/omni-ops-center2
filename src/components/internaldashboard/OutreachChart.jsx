import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { format, parseISO } from "date-fns";

export default function OutreachChart({ chartData }) {
  if (!chartData || chartData.length === 0) {
    return <div className="flex items-center justify-center h-40 text-sm text-gray-400">No chart data available.</div>;
  }

  const formatted = chartData.map(d => ({
    ...d,
    label: format(parseISO(d.date), "MMM d"),
  }));

  // Single data point — show a bar chart with labeled metrics instead of a broken line
  if (formatted.length === 1) {
    const d = formatted[0];
    const barData = [
      { name: "Connection Requests", value: d.connections, color: "#6366f1" },
      { name: "InMails Sent", value: d.inmails, color: "#10b981" },
      { name: "Conn. Accepted", value: d.connectionsAccepted || 0, color: "#a78bfa" },
    ];

    return (
      <div className="h-[220px] flex flex-col justify-center">
        <p className="text-xs text-gray-400 mb-3 text-center">{d.label}</p>
        <div className="flex items-end justify-center gap-6 flex-1">
          {barData.map(item => (
            <div key={item.name} className="flex flex-col items-center gap-2">
              <span className="text-2xl font-bold" style={{ color: item.color }}>{item.value.toLocaleString()}</span>
              <div
                className="w-14 rounded-t-md"
                style={{
                  backgroundColor: item.color,
                  height: `${Math.max(8, Math.round((item.value / Math.max(...barData.map(b => b.value), 1)) * 80))}px`,
                  opacity: 0.85,
                }}
              />
              <span className="text-[10px] text-gray-400 text-center leading-tight">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Multi-day — area chart
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="connGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="inmailGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,100,100,0.1)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#f9fafb", fontWeight: 600 }}
          itemStyle={{ color: "#d1d5db" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="connections" name="Connection Requests" stroke="#6366f1" fill="url(#connGrad)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="inmails" name="InMails Sent" stroke="#10b981" fill="url(#inmailGrad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}