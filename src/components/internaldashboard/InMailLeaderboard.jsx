import { Mail, Link } from "lucide-react";

export default function InMailLeaderboard({ accounts, days }) {
  // Only show accounts with InMails OR connections > 0
  const withActivity = accounts
    .filter(a => a.inmails > 0 || a.connections > 0)
    .sort((a, b) => b.connections - a.connections || b.inmails - a.inmails);

  const inmailers = accounts
    .filter(a => a.inmails > 0)
    .sort((a, b) => b.inmails - a.inmails);

  const maxConn = Math.max(...withActivity.map(a => a.connections), 1);

  if (withActivity.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-gray-400">
        No outreach activity in the last {days} days.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* InMails highlight — only shown if anyone sent InMails */}
      {inmailers.length > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Mail className="w-3.5 h-3.5 text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">InMails Sent (last {days}d)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {inmailers.map(a => (
              <div key={a.name} className="flex items-center gap-1.5 bg-emerald-500/10 rounded-full px-3 py-1">
                <span className="text-xs font-semibold text-emerald-300">{a.name}</span>
                <span className="text-xs font-bold text-emerald-400">{a.inmails}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection leaderboard */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Link className="w-3.5 h-3.5 text-violet-400" />
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Connection Requests (last {days}d)</p>
        </div>
        <div className="space-y-1.5">
          {withActivity.map((acc, i) => (
            <div key={acc.name} className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-gray-500 w-4 text-right">{i + 1}</span>
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 w-20 truncate">{acc.name}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${Math.round((acc.connections / maxConn) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-gray-900 dark:text-white w-10 text-right">{acc.connections}</span>
              {acc.connections_accepted > 0 && (
                <span className="text-[10px] text-green-500 w-16 text-right">
                  {Math.round((acc.connections_accepted / Math.max(acc.connections, 1)) * 100)}% acc.
                </span>
              )}
              {acc.inmails > 0 && (
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                  +{acc.inmails} InMail
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}