import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, UserCheck, Clock, History, Settings, RefreshCw } from "lucide-react";
import { useWorkspace } from "@/context/SalesNavWorkspaceContext";

const NAV = [
  { label: "Dashboard",     path: "/SalesNavDashboard",  icon: LayoutDashboard },
  { label: "Onboarding",    path: "/SalesNavOnboarding", icon: UserCheck },
  { label: "Expiring Soon", path: "/SalesNavExpiring",   icon: Clock },
  { label: "History",       path: "/SalesNavHistory",    icon: History },
  { label: "Settings",      path: "/SalesNavSettings",   icon: Settings },
];

export default function SalesNavSidebar() {
  const location = useLocation();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border shrink-0">
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
          <RefreshCw className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-bold text-sm text-sidebar-foreground">Sales Nav Manager</span>
      </div>

      {/* Workspace switcher */}
      {workspaces.length > 0 && (
        <div className="px-3 pt-3 pb-2 border-b border-sidebar-border">
          <p className="text-xs text-muted-foreground mb-1.5 px-1">Workspace</p>
          <select
            value={activeWorkspace?.id || ""}
            onChange={e => {
              const ws = workspaces.find(w => w.id === e.target.value);
              if (ws) setActiveWorkspace(ws);
            }}
            className="w-full text-xs rounded-lg bg-sidebar-accent text-sidebar-foreground border border-sidebar-border px-2 py-1.5 outline-none"
          >
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, path, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? "bg-blue-600 text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sidebar-border text-xs text-muted-foreground">
        Polls every 10 min
      </div>
    </aside>
  );
}