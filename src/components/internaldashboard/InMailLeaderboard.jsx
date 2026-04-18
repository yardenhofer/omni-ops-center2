import { Mail, Link } from "lucide-react";

export default function InMailLeaderboard({ accounts, days }) {
  // Show ALL accounts, sorted by InMails desc, then connections desc
  const sorted = [...accounts].sort((a, b) => b.inmails - a.inmails || b.connections - a.connections);

  const maxInmails = Math.max(...sorted.map(a => a.inmails), 1);
  const maxConn = Math.max(...sorted.map(a => a.connections), 1);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-gray-400">
        No senders found.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {sorted.map((acc, i) => (
        <div key={acc.name} className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 w-4 text-right shrink-0">{i + 1}</span>
          <span className="text-xs font-medium text-gray-800 dark:text-gray-200 w-20 truncate shrink-0">{acc.name}</span>

          {/* InMail bar */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Mail className="w-3 h-3 text-emerald-400 shrink-0" />
            <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.round((acc.inmails / maxInmails) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-emerald-500 w-8 text-right shrink-0">{acc.inmails}</span>
          </div>

          {/* Connection bar */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Link className="w-3 h-3 text-violet-400 shrink-0" />
            <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-400"
                style={{ width: `${Math.round((acc.connections / maxConn) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-violet-400 w-8 text-right shrink-0">{acc.connections}</span>
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-1">
          <Mail className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] text-gray-400">InMails</span>
        </div>
        <div className="flex items-center gap-1">
          <Link className="w-3 h-3 text-violet-400" />
          <span className="text-[10px] text-gray-400">Connections</span>
        </div>
      </div>
    </div>
  );
}