import { useState, useEffect } from "react";
import { AlertTriangle, X, WifiOff } from "lucide-react";

const DISMISSED_KEY = "heyreach_disconnected_dismissed";

function getDismissed() {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); } catch { return []; }
}
function saveDismissed(ids) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
}

export default function DisconnectedAccountsAlert({ workspaces }) {
  const [dismissed, setDismissed] = useState(getDismissed);

  // Collect all disconnected accounts across workspaces
  const allDisconnected = workspaces.flatMap(ws =>
    (ws.disconnectedAccounts || []).map(a => ({
      ...a,
      client_name: ws.client_name,
      key: `${ws.client_id}_${a.id}`,
    }))
  );

  // Filter out dismissed ones, and ones that are no longer disconnected
  const activeDisconnected = allDisconnected.filter(a => !dismissed.includes(a.key));

  // Auto-clear dismissed entries that are no longer present (reconnected)
  useEffect(() => {
    const currentKeys = allDisconnected.map(a => a.key);
    const cleaned = dismissed.filter(k => currentKeys.includes(k));
    if (cleaned.length !== dismissed.length) {
      setDismissed(cleaned);
      saveDismissed(cleaned);
    }
  }, [workspaces]);

  if (activeDisconnected.length === 0) return null;

  function dismiss(key) {
    const updated = [...dismissed, key];
    setDismissed(updated);
    saveDismissed(updated);
  }

  function dismissAll() {
    const updated = [...dismissed, ...activeDisconnected.map(a => a.key)];
    setDismissed(updated);
    saveDismissed(updated);
  }

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <WifiOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-400">
            {activeDisconnected.length} Disconnected LinkedIn Account{activeDisconnected.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={dismissAll}
          className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors"
        >
          Dismiss all
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {activeDisconnected.map(a => (
          <div key={a.key} className="flex items-center justify-between bg-red-500/10 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-sm text-gray-200 font-medium">{a.name}</span>
              <span className="text-xs text-gray-400">· {a.client_name}</span>
              <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full font-mono uppercase">
                {a.status}
              </span>
            </div>
            <button
              onClick={() => dismiss(a.key)}
              className="text-gray-500 hover:text-gray-300 transition-colors ml-3"
              title="Don't show again"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}