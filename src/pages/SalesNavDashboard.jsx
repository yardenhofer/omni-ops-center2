import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/context/SalesNavWorkspaceContext";
import StatusBadge from "@/components/salesnav/StatusBadge";
import ClaimModal from "@/components/salesnav/ClaimModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, ExternalLink, AlertTriangle, Users, CheckCircle, XCircle, ShieldAlert } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export default function SalesNavDashboard() {
  const { activeWorkspace } = useWorkspace();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("needs_attention");
  const [filterSalesNav, setFilterSalesNav] = useState(false);
  const [claimTarget, setClaimTarget] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const data = await base44.entities.LinkedInAccount.filter({ workspace_id: activeWorkspace.id }, '-disconnected_at', 200);
    setAccounts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-poll every 10 minutes
  useEffect(() => {
    const interval = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    try {
      await base44.functions.invoke('checkHeyReachAccounts', {});
      setLastSync(new Date());
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function handleClaim(account, name) {
    const now = new Date().toISOString();
    await base44.entities.LinkedInAccount.update(account.id, {
      status: 'in_progress',
      assigned_to: name,
      assigned_at: now,
    });
    setClaimTarget(null);
    await load();
  }

  async function handleMarkRefreshed(account) {
    const now = new Date();
    const refreshedAt = now.toISOString();
    const licenseExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    let timeToResolve = null;
    if (account.disconnected_at) {
      timeToResolve = Math.round((now - new Date(account.disconnected_at)) / 60000);
    }
    await base44.entities.LinkedInAccount.update(account.id, {
      status: 'refreshed',
      refreshed_at: refreshedAt,
      license_expires_estimate: licenseExpires,
    });
    // Log to history
    await base44.entities.RefreshHistory.create({
      heyreach_account_id: account.heyreach_account_id,
      account_name: `${account.first_name || ''} ${account.last_name || ''}`.trim(),
      profile_url: account.profile_url,
      workspace_id: account.workspace_id,
      disconnected_at: account.disconnected_at,
      refreshed_at: refreshedAt,
      refreshed_by: account.assigned_to || 'Unknown',
      time_to_resolve_minutes: timeToResolve,
    });
    await load();
  }

  async function handleUnclaim(account) {
    await base44.entities.LinkedInAccount.update(account.id, {
      status: 'disconnected',
      assigned_to: null,
      assigned_at: null,
    });
    await load();
  }

  async function handleReset(account) {
    await base44.entities.LinkedInAccount.update(account.id, {
      status: 'connected',
      disconnected_at: null,
      assigned_to: null,
      assigned_at: null,
      refreshed_at: null,
    });
    await load();
  }

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    const name = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
    const matchSearch = !q || name.includes(q) || (a.email_address || '').toLowerCase().includes(q);
    const matchSalesNav = !filterSalesNav || !a.is_valid_navigator;
    if (tab === 'needs_attention') {
      return matchSearch && matchSalesNav && ['disconnected', 'in_progress'].includes(a.status);
    }
    return matchSearch && matchSalesNav;
  });

  const total = accounts.length;
  const connected = accounts.filter(a => a.status === 'connected').length;
  const disconnected = accounts.filter(a => a.status === 'disconnected').length;
  const salesNavIssues = accounts.filter(a => !a.is_valid_navigator).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Account Health Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeWorkspace?.name} · {lastSync ? `Last synced ${format(lastSync, 'h:mm a')}` : 'Not synced yet'}
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Accounts", value: total, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Connected", value: connected, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
          { label: "Disconnected", value: disconnected, icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
          { label: "Sales Nav Issues", value: salesNavIssues, icon: ShieldAlert, color: "text-orange-500", bg: "bg-orange-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {[
            { key: 'needs_attention', label: 'Needs Attention' },
            { key: 'all', label: 'All Accounts' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <button
          onClick={() => setFilterSalesNav(v => !v)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            filterSalesNav ? 'bg-orange-500/10 border-orange-500/30 text-orange-600' : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Sales Nav Issue
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array(5).fill(0).map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {tab === 'needs_attention' ? '✅ No accounts need attention right now.' : 'No accounts found.'}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Auth</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sales Nav</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Disconnected</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned To</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(acc => (
                  <tr key={acc.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{acc.first_name} {acc.last_name}</span>
                        {acc.profile_url && (
                          <a href={acc.profile_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{acc.email_address || '—'}</td>
                    <td className="px-4 py-3">
                      {acc.auth_is_valid
                        ? <span className="text-green-500 text-xs font-medium">✓ Valid</span>
                        : <span className="text-red-500 text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Invalid</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {acc.is_valid_navigator
                        ? <span className="text-green-500 text-xs font-medium">✓ Valid</span>
                        : <span className="text-orange-500 text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Issue</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {acc.disconnected_at ? formatDistanceToNow(new Date(acc.disconnected_at), { addSuffix: true }) : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={acc.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">{acc.assigned_to || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {acc.status === 'disconnected' && (
                          <button onClick={() => setClaimTarget(acc)} className="px-2 py-1 text-xs rounded-md bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20 font-medium">
                            Claim
                          </button>
                        )}
                        {acc.status === 'in_progress' && (
                          <>
                            <button onClick={() => handleMarkRefreshed(acc)} className="px-2 py-1 text-xs rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 font-medium">
                              Mark Refreshed
                            </button>
                            <button onClick={() => handleUnclaim(acc)} className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-muted-foreground hover:text-foreground font-medium">
                              Unclaim
                            </button>
                          </>
                        )}
                        {(acc.status === 'refreshed' || acc.status === 'in_progress') && (
                          <button onClick={() => handleReset(acc)} className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-muted-foreground hover:text-foreground font-medium">
                            Reset
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {claimTarget && (
        <ClaimModal
          account={claimTarget}
          onConfirm={(name) => handleClaim(claimTarget, name)}
          onClose={() => setClaimTarget(null)}
        />
      )}
    </div>
  );
}