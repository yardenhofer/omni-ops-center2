import { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.SalesNavWorkspace.list('-created_date', 100).then(ws => {
      if (!Array.isArray(ws)) ws = [];
      setWorkspaces(ws);
      const savedId = localStorage.getItem('salesNavWorkspaceId');
      const saved = ws.find(w => w.id === savedId);
      const def = ws.find(w => w.is_default) || ws[0];
      setActiveWorkspaceState(saved || def || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function setActiveWorkspace(ws) {
    setActiveWorkspaceState(ws);
    if (ws) localStorage.setItem('salesNavWorkspaceId', ws.id);
  }

  function refreshWorkspaces() {
    return base44.entities.SalesNavWorkspace.list('-created_date', 100).then(ws => {
      if (!Array.isArray(ws)) ws = [];
      setWorkspaces(ws);
      return ws;
    });
  }

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, setActiveWorkspace, loading, refreshWorkspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}