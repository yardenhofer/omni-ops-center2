import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/context/SalesNavWorkspaceContext";
import OnboardingBadge from "@/components/salesnav/OnboardingBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Users, Send, Clock, ShieldX, CheckCircle2 } from "lucide-react";
import { fetchResellerNames } from "@/utils/resellerNames";
import { format } from "date-fns";

const ONBOARDING_STATUSES = ["pending", "link_sent", "pending_2fa", "restricted", "completed"];
const RESELLERS = ["reseller_1", "reseller_2", "reseller_3"];

export default function SalesNavOnboarding() {
  const { activeWorkspace } = useWorkspace();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [resellerNames, setResellerNames] = useState({ reseller_1: "Reseller 1", reseller_2: "Reseller 2", reseller_3: "Reseller 3" });
  const [saving, setSaving] = useState({});

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const data = await base44.entities.LinkedInAccount.filter({ workspace_id: activeWorkspace.id }, '-created_date', 500);
    setAccounts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    load();
    fetchResellerNames().then(setResellerNames);
  }, [load]);

  async function updateAccount(id, updates) {
    setSaving(s => ({ ...s, [id]: true }));
    if (updates.onboarding_status === 'completed') {
      const acc = accounts.find(a => a.id === id);
      if (acc && acc.onboarding_status !== 'completed') {
        updates.onboarding_completed_at = new Date().toISOString();
      }
    }
    await base44.entities.LinkedInAccount.update(id, updates);
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    setSaving(s => ({ ...s, [id]: false }));
  }

  function exportCSV(rows, filename) {
    const headers = ["Name", "Email", "Onboarding Status", "Reseller", "Assigned To", "Completed At", "Notes"];
    const csvRows = rows.map(a => [
      `${a.first_name || ''} ${a.last_name || ''}`.trim(),
      a.email_address || '',
      a.onboarding_status || '',
      resellerNames[a.reseller] || a.reseller || '',
      a.onboarding_assigned_to || '',
      a.onboarding_completed_at ? format(new Date(a.onboarding_completed_at), 'yyyy-MM-dd') : '',
      (a.onboarding_notes || '').replace(/,/g, ';'),
    ]);
    const csv = [headers, ...csvRows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    const name = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
    const matchSearch = !q || name.includes(q) || (a.email_address || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || a.onboarding_status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    pending: accounts.filter(a => a.onboarding_status === 'pending').length,
    link_sent: accounts.filter(a => a.onboarding_status === 'link_sent').length,
    pending_2fa: accounts.filter(a => a.onboarding_status === 'pending_2fa').length,
    restricted: accounts.filter(a => a.onboarding_status === 'restricted').length,
    completed: accounts.filter(a => a.onboarding_status === 'completed').length,
  };

  const activeResellers = RESELLERS.filter(r => accounts.some(a => a.reseller === r));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Nav Onboarding</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{activeWorkspace?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(filtered, 'onboarding_all.csv')} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export All
          </Button>
          {activeResellers.map(r => (
            <Button key={r} variant="outline" size="sm" onClick={() => exportCSV(accounts.filter(a => a.reseller === r), `onboarding_${r}.csv`)} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> {resellerNames[r]}
            </Button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: 'pending', label: 'Pending', icon: Users, color: 'text-gray-500', bg: 'bg-gray-500/10' },
          { key: 'link_sent', label: 'Link Sent', icon: Send, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { key: 'pending_2fa', label: 'Pending 2FA', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
          { key: 'restricted', label: 'Restricted', icon: ShieldX, color: 'text-red-500', bg: 'bg-red-500/10' },
          { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
        ].map(({ key, label, icon: Icon, color, bg }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
            className={`bg-card border rounded-xl p-3 flex items-center gap-3 transition-all ${filterStatus === key ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-border hover:border-blue-300'}`}
          >
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-foreground">{counts[key]}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <Input placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reseller</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned To</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed At</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-48">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(acc => (
                  <tr key={acc.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2 font-medium text-foreground">{acc.first_name} {acc.last_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{acc.email_address || '—'}</td>
                    <td className="px-4 py-2">
                      <select
                        value={acc.onboarding_status || 'pending'}
                        onChange={e => updateAccount(acc.id, { onboarding_status: e.target.value })}
                        className="text-xs rounded-md bg-muted border border-border px-2 py-1 text-foreground outline-none"
                        disabled={saving[acc.id]}
                      >
                        {ONBOARDING_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={acc.reseller || ''}
                        onChange={e => updateAccount(acc.id, { reseller: e.target.value || null })}
                        className="text-xs rounded-md bg-muted border border-border px-2 py-1 text-foreground outline-none"
                        disabled={saving[acc.id]}
                      >
                        <option value="">—</option>
                        {RESELLERS.map(r => <option key={r} value={r}>{resellerNames[r]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        defaultValue={acc.onboarding_assigned_to || ''}
                        onBlur={e => updateAccount(acc.id, { onboarding_assigned_to: e.target.value })}
                        placeholder="—"
                        className="text-xs bg-transparent border-b border-transparent hover:border-border focus:border-blue-500 outline-none text-foreground w-24 py-0.5 transition-colors"
                      />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {acc.onboarding_completed_at ? format(new Date(acc.onboarding_completed_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        defaultValue={acc.onboarding_notes || ''}
                        onBlur={e => updateAccount(acc.id, { onboarding_notes: e.target.value })}
                        placeholder="Add notes…"
                        className="text-xs bg-transparent border-b border-transparent hover:border-border focus:border-blue-500 outline-none text-muted-foreground w-full py-0.5 transition-colors"
                      />
                    </td>
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