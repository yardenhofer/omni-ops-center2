import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Linkedin, AlertTriangle, ChevronDown, ChevronRight, Users, BarChart3, TrendingUp, Activity } from "lucide-react";

function PctBar({ pct }) {
  if (pct == null) return <span className="text-xs text-gray-400">—</span>;
  const color = pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-orange-500" : "bg-green-500";
  const text = pct >= 80 ? "text-red-500" : pct >= 60 ? "text-orange-500" : "text-green-500";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-sm font-bold ${text}`}>{pct}%</span>
      <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function WorkspaceCard({ workspace }) {
  const [expanded, setExpanded] = useState(true);
  const { client_name, accounts, campaigns, summary, error } = workspace;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Linkedin className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{client_name}</p>
            {error ? (
              <p className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                <AlertTriangle className="w-3 h-3" /> {error}
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                {summary?.total_accounts ?? 0} senders · {summary?.active_campaigns ?? 0} active campaigns
              </p>
            )}
          </div>
        </div>

        {!error && summary && (
          <div className="flex items-center gap-6 mr-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400">Total Leads</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{(summary.total_leads || 0).toLocaleString()}</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400">In Progress</p>
              <p className="text-sm font-bold text-blue-500">{(summary.total_in_progress || 0).toLocaleString()}</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400">Finished</p>
              <p className="text-sm font-bold text-green-500">{(summary.total_finished || 0).toLocaleString()}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-xs text-gray-400 text-center mb-0.5">Overall %</p>
              {summary.active_campaigns === 0
                ? <span className="text-xs text-yellow-400 font-medium">No active</span>
                : <PctBar pct={summary.completion_pct} />
              }
            </div>
          </div>
        )}

        <div className="text-gray-400 shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {expanded && !error && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {/* Per-sender accounts */}
          {accounts.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">LinkedIn Senders</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {accounts.map(acc => (
                  <div key={acc.name} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{acc.name}</p>
                      <span className={`text-xs font-bold ${
                        acc.completion_pct >= 80 ? 'text-red-500' : acc.completion_pct >= 60 ? 'text-orange-500' : 'text-green-500'
                      }`}>{acc.completion_pct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full ${acc.completion_pct >= 80 ? 'bg-red-500' : acc.completion_pct >= 60 ? 'bg-orange-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, acc.completion_pct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>{acc.finished_leads.toLocaleString()} done</span>
                      <span>{acc.in_progress.toLocaleString()} active</span>
                      <span>{acc.total_leads.toLocaleString()} total</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Campaigns */}
          {campaigns.length > 0 && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-1.5 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Campaigns ({campaigns.length})</p>
              </div>
              <div className="space-y-1.5">
                {campaigns.map(camp => (
                  <div key={camp.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{camp.name}</p>
                      <p className="text-[10px] text-gray-400">{camp.finished_leads.toLocaleString()} finished · {camp.in_progress.toLocaleString()} active · {camp.total_leads.toLocaleString()} total</p>
                    </div>
                    <div className="shrink-0 ml-3">
                      <PctBar pct={camp.completion_pct} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {accounts.length === 0 && campaigns.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">No active campaigns found.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InternalDashboard() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("heyReachAccountStats", {});
      setWorkspaces(res.data.workspaces || []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e?.message || "Failed to load data");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const totalAccounts = workspaces.reduce((s, w) => s + (w.summary?.total_accounts || 0), 0);
  const totalLeads = workspaces.reduce((s, w) => s + (w.summary?.total_leads || 0), 0);
  const totalInProgress = workspaces.reduce((s, w) => s + (w.summary?.total_in_progress || 0), 0);
  const totalActiveCampaigns = workspaces.reduce((s, w) => s + (w.summary?.active_campaigns || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center">
              <Linkedin className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Internal Dashboard</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            LinkedIn campaign status across all HeyReach workspaces
            {lastUpdated && <span className="ml-2 text-xs text-gray-400">· Updated {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary stats */}
      {!loading && workspaces.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "LinkedIn Senders", value: totalAccounts, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Active Campaigns", value: totalActiveCampaigns, icon: BarChart3, color: "text-violet-500", bg: "bg-violet-500/10" },
            { label: "Leads In Progress", value: totalInProgress.toLocaleString(), icon: Activity, color: "text-orange-500", bg: "bg-orange-500/10" },
            { label: "Total Leads", value: totalLeads.toLocaleString(), icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array(2).fill(0).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No HeyReach workspaces configured.
        </div>
      ) : (
        <div className="space-y-4">
          {workspaces.map(w => (
            <WorkspaceCard key={w.client_id} workspace={w} />
          ))}
        </div>
      )}
    </div>
  );
}