import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Linkedin, AlertTriangle, ChevronDown, ChevronRight, Users, BarChart3, Mail, Link2, ChevronLeft, Calendar } from "lucide-react";
import OutreachChart from "@/components/internaldashboard/OutreachChart";
import InMailLeaderboard from "@/components/internaldashboard/InMailLeaderboard";
import DisconnectedAccountsAlert from "@/components/internaldashboard/DisconnectedAccountsAlert";

const PERIOD_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
];

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

function WorkspaceCard({ workspace, days }) {
  const [expanded, setExpanded] = useState(true);
  const { client_name, accounts = [], campaigns = [], chartData = [], summary, error } = workspace;

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
          <div className="flex items-center gap-5 mr-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400">Connections Sent</p>
              <p className="text-sm font-bold text-violet-500">{(summary.total_connections || 0).toLocaleString()}</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400">InMails Sent</p>
              <p className="text-sm font-bold text-emerald-500">{(summary.total_inmails || 0).toLocaleString()}</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400">In Progress</p>
              <p className="text-sm font-bold text-blue-500">{(summary.total_in_progress || 0).toLocaleString()}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-xs text-gray-400 text-center mb-0.5">Completion</p>
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
        <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">

          {/* Outreach activity — chart + leaderboard */}
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Daily Outreach (last {days}d)</p>
              </div>
              <OutreachChart chartData={chartData} />
            </div>
            {/* Leaderboard */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Per Sender Activity</p>
              </div>
              <InMailLeaderboard accounts={accounts} days={days} />
            </div>
          </div>

          {/* Per-sender campaign progress */}
          {accounts.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Link2 className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Campaign Progress by Sender</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {accounts.filter(a => a.total_leads > 0).map(acc => (
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

          {/* Active Campaigns list */}
          {campaigns.length > 0 && (
            <div className="p-4">
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

// Session-level cache to avoid re-fetching from DB on period switch
const sessionCache = {};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export default function InternalDashboard() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [days, setDays] = useState(1);
  const [syncing, setSyncing] = useState(false);
  // specific date mode
  const [specificDate, setSpecificDate] = useState(null); // null = use preset rolling window

  async function loadFromDB(d) {
    if (sessionCache[d]) {
      setWorkspaces(sessionCache[d].workspaces);
      setLastUpdated(sessionCache[d].lastUpdated);
      setLoading(false);
      return true;
    }
    const records = await base44.entities.HeyReachCache.filter({ days: d });
    if (!records || records.length === 0) return false;

    const ws = records
      .filter(r => r.workspace_data)
      .map(r => JSON.parse(r.workspace_data));

    ws.sort((a, b) => {
      if (a.client_id === '__internal__') return -1;
      if (b.client_id === '__internal__') return 1;
      return (a.client_name || '').localeCompare(b.client_name || '');
    });

    const syncedAt = new Date(records[0].synced_at);
    sessionCache[d] = { workspaces: ws, lastUpdated: syncedAt };
    setWorkspaces(ws);
    setLastUpdated(syncedAt);
    return true;
  }

  async function loadForDate(dateStr) {
    setLoading(true);
    setError(null);
    const cacheKey = `date_${dateStr}`;
    if (sessionCache[cacheKey]) {
      setWorkspaces(sessionCache[cacheKey].workspaces);
      setLastUpdated(sessionCache[cacheKey].lastUpdated);
      setLoading(false);
      return;
    }
    // Calculate how many days ago this date was, then call live API with that window
    const target = new Date(dateStr);
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysAgo = Math.round((now - target) / msPerDay);
    // We use the start of the target date and end of the target date
    const startDate = new Date(dateStr + 'T00:00:00.000Z').toISOString();
    const endDate = new Date(dateStr + 'T23:59:59.999Z').toISOString();
    try {
      const resp = await base44.functions.invoke('heyReachAccountStats', { days: 1, startDate, endDate });
      const ws = (resp.data?.workspaces || []).sort((a, b) => {
        if (a.client_id === '__internal__') return -1;
        if (b.client_id === '__internal__') return 1;
        return (a.client_name || '').localeCompare(b.client_name || '');
      });
      const updatedAt = new Date();
      sessionCache[cacheKey] = { workspaces: ws, lastUpdated: updatedAt };
      setWorkspaces(ws);
      setLastUpdated(updatedAt);
    } catch (err) {
      setError("Failed to load data for that date: " + (err?.message || err));
    }
    setLoading(false);
  }

  async function load(d) {
    setLoading(true);
    setError(null);
    const hit = await loadFromDB(d);
    if (!hit) setError("No data cached yet — the background sync runs every 15 minutes. Please check back shortly.");
    setLoading(false);
  }

  async function refresh() {
    setSyncing(true);
    for (const k of Object.keys(sessionCache)) delete sessionCache[k];
    if (specificDate) {
      await loadForDate(specificDate);
    } else {
      await load(days);
    }
    setSyncing(false);
  }

  useEffect(() => {
    load(days);
  }, []);

  async function handlePeriodChange(d) {
    setSpecificDate(null);
    setDays(d);
    if (sessionCache[d]) {
      setWorkspaces(sessionCache[d].workspaces);
      setLastUpdated(sessionCache[d].lastUpdated);
      return;
    }
    setLoading(true);
    const hit = await loadFromDB(d);
    if (!hit) setError("No data cached for this period yet.");
    setLoading(false);
  }

  function handleDateNav(direction) {
    const base = specificDate || todayStr();
    const d = new Date(base + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + direction);
    const next = d.toISOString().split('T')[0];
    // Don't go into the future
    if (next > todayStr()) return;
    setSpecificDate(next);
    setDays(null);
    loadForDate(next);
  }

  function handleTodayClick() {
    if (specificDate) {
      // Already in date mode — navigate to today
      setSpecificDate(todayStr());
      setDays(null);
      loadForDate(todayStr());
    } else {
      // In preset mode — switch to Today preset (1 day rolling)
      handlePeriodChange(1);
    }
  }

  const totalAccounts = workspaces.reduce((s, w) => s + (w.summary?.total_accounts || 0), 0);
  const totalConnections = workspaces.reduce((s, w) => s + (w.summary?.total_connections || 0), 0);
  const totalInmails = workspaces.reduce((s, w) => s + (w.summary?.total_inmails || 0), 0);
  const totalActiveCampaigns = workspaces.reduce((s, w) => s + (w.summary?.active_campaigns || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center">
              <Linkedin className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Internal Dashboard</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            LinkedIn campaign status across all HeyReach workspaces
            {syncing && <span className="ml-2 text-xs text-yellow-400">· Syncing from HeyReach…</span>}
            {!syncing && lastUpdated && <span className="ml-2 text-xs text-gray-400">· Last synced {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period filter */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => handlePeriodChange(opt.days)}
                disabled={loading}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  !specificDate && days === opt.days
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Specific date navigator */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => handleDateNav(-1)}
              disabled={loading}
              className="p-1 rounded-md text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Previous day"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="relative flex items-center">
              <Calendar className="w-3 h-3 text-gray-400 absolute left-2 pointer-events-none" />
              <input
                type="date"
                max={todayStr()}
                value={specificDate || ''}
                onChange={e => {
                  if (!e.target.value) return;
                  setSpecificDate(e.target.value);
                  setDays(null);
                  loadForDate(e.target.value);
                }}
                className={`pl-6 pr-2 py-1 rounded-md text-xs font-medium bg-transparent border-0 outline-none cursor-pointer transition-colors
                  ${specificDate
                    ? "text-violet-600 dark:text-violet-400 bg-white dark:bg-gray-700"
                    : "text-gray-500 dark:text-gray-400"
                  }`}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <button
              onClick={() => handleDateNav(1)}
              disabled={loading || specificDate === todayStr() || !specificDate}
              className="p-1 rounded-md text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
              title="Next day"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={refresh}
            disabled={syncing || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Loading…" : "Reload"}
          </button>
        </div>
      </div>

      {/* Disconnected accounts alert */}
      {!loading && workspaces.length > 0 && (
        <DisconnectedAccountsAlert workspaces={workspaces} />
      )}

      {/* Summary stats */}
      {!loading && workspaces.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "LinkedIn Senders", value: totalAccounts, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Active Campaigns", value: totalActiveCampaigns, icon: BarChart3, color: "text-violet-500", bg: "bg-violet-500/10" },
            { label: `InMails Sent (${specificDate || `${days}d`})`, value: totalInmails.toLocaleString(), icon: Mail, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: `Connections Sent (${specificDate || `${days}d`})`, value: totalConnections.toLocaleString(), icon: Link2, color: "text-indigo-500", bg: "bg-indigo-500/10" },
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
            <div key={i} className="h-48 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
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
            <WorkspaceCard key={w.client_id} workspace={w} days={days} />
          ))}
        </div>
      )}
    </div>
  );
}