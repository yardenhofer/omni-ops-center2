import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/context/SalesNavWorkspaceContext";
import { Clock, AlertTriangle } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";

function DaysChip({ days }) {
  if (days <= 2) return <span className="text-red-500 font-bold">{days}d</span>;
  if (days <= 5) return <span className="text-orange-500 font-bold">{days}d</span>;
  return <span className="text-yellow-500 font-bold">{days}d</span>;
}

export default function SalesNavExpiring() {
  const { activeWorkspace } = useWorkspace();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const data = await base44.entities.LinkedInAccount.filter({
      workspace_id: activeWorkspace.id,
      onboarding_status: 'completed',
    }, '-onboarding_completed_at', 500);
    setAccounts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  const now = new Date();
  const expiring = accounts
    .map(a => {
      if (!a.onboarding_completed_at) return null;
      const deadline = addDays(new Date(a.onboarding_completed_at), 30);
      const daysLeft = differenceInDays(deadline, now);
      if (daysLeft > 7 || daysLeft < 0) return null;
      return { ...a, deadline, daysLeft };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock className="w-6 h-6 text-orange-500" /> Expiring Soon
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Sales Nav re-seller renewals due within 7 days · {activeWorkspace?.name}</p>
      </div>

      {loading ? (
        <div className="space-y-2">{Array(4).fill(0).map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : expiring.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-7 h-7 text-green-500" />
          </div>
          <p className="font-semibold text-foreground">No renewals due in the next 7 days</p>
          <p className="text-sm text-muted-foreground mt-1">You're all caught up.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 text-sm text-orange-600 dark:text-orange-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {expiring.length} account{expiring.length !== 1 ? 's' : ''} need renewal within 7 days
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed At</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Renewal Deadline</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Days Left</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expiring.map(acc => (
                    <tr key={acc.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{acc.first_name} {acc.last_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{acc.email_address || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(acc.onboarding_completed_at), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-3 text-foreground">{format(acc.deadline, 'MMM d, yyyy')}</td>
                      <td className="px-4 py-3"><DaysChip days={acc.daysLeft} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{acc.onboarding_assigned_to || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}