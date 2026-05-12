import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/context/SalesNavWorkspaceContext";
import { Input } from "@/components/ui/input";
import { ExternalLink, History } from "lucide-react";
import { format, parseISO, isWithinInterval } from "date-fns";

export default function SalesNavHistory() {
  const { activeWorkspace } = useWorkspace();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const data = await base44.entities.RefreshHistory.filter({ workspace_id: activeWorkspace.id }, '-refreshed_at', 500);
    setRecords(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => { load(); }, [load]);

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || (r.account_name || '').toLowerCase().includes(q);
    let matchDate = true;
    if (from || to) {
      const d = r.refreshed_at ? parseISO(r.refreshed_at) : null;
      if (!d) return false;
      if (from && d < parseISO(from + 'T00:00:00')) matchDate = false;
      if (to && d > parseISO(to + 'T23:59:59')) matchDate = false;
    }
    return matchSearch && matchDate;
  });

  const totalRefreshes = filtered.length;
  const avgResolve = filtered.filter(r => r.time_to_resolve_minutes).length > 0
    ? Math.round(filtered.filter(r => r.time_to_resolve_minutes).reduce((s, r) => s + r.time_to_resolve_minutes, 0) / filtered.filter(r => r.time_to_resolve_minutes).length)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="w-6 h-6 text-violet-500" /> Refresh History
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{activeWorkspace?.name} · Audit log of all account refreshes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold text-foreground">{totalRefreshes}</p>
          <p className="text-sm text-muted-foreground">Total Refreshes</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold text-foreground">{avgResolve != null ? `${avgResolve}m` : '—'}</p>
          <p className="text-sm text-muted-foreground">Avg Resolution Time</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search account name…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs h-9" />
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="text-sm rounded-lg bg-card border border-border px-3 py-1.5 text-foreground outline-none" style={{ colorScheme: 'dark' }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="text-sm rounded-lg bg-card border border-border px-3 py-1.5 text-foreground outline-none" style={{ colorScheme: 'dark' }} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No refresh history found.</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Disconnected At</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Refreshed At</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resolved By</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time to Resolve</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{r.account_name}</span>
                        {r.profile_url && (
                          <a href={r.profile_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.disconnected_at ? format(new Date(r.disconnected_at), 'MMM d, h:mm a') : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.refreshed_at ? format(new Date(r.refreshed_at), 'MMM d, h:mm a') : '—'}</td>
                    <td className="px-4 py-3 text-foreground">{r.refreshed_by || '—'}</td>
                    <td className="px-4 py-3">
                      {r.time_to_resolve_minutes != null ? (
                        <span className={`font-medium ${r.time_to_resolve_minutes > 120 ? 'text-red-500' : r.time_to_resolve_minutes > 60 ? 'text-orange-500' : 'text-green-500'}`}>
                          {r.time_to_resolve_minutes < 60 ? `${r.time_to_resolve_minutes}m` : `${Math.round(r.time_to_resolve_minutes / 60)}h ${r.time_to_resolve_minutes % 60}m`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}