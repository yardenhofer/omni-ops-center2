import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/context/SalesNavWorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Plus, Trash2, Save, Check } from "lucide-react";
import { clearResellerCache } from "@/utils/resellerNames";

const RESELLERS = ["reseller_1", "reseller_2", "reseller_3"];

export default function SalesNavSettings() {
  const { workspaces, refreshWorkspaces } = useWorkspace();
  const [resellerNames, setResellerNames] = useState({ reseller_1: "Reseller 1", reseller_2: "Reseller 2", reseller_3: "Reseller 3" });
  const [costs, setCosts] = useState({ reseller_1: 0, reseller_2: 0, reseller_3: 0 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settingsId, setSettingsId] = useState(null);

  // New workspace form
  const [newWsName, setNewWsName] = useState("");
  const [newWsDesc, setNewWsDesc] = useState("");
  const [newWsKey, setNewWsKey] = useState("");
  const [newWsColor, setNewWsColor] = useState("#6366f1");
  const [creatingWs, setCreatingWs] = useState(false);
  const [deletingWs, setDeletingWs] = useState(null);

  useEffect(() => {
    base44.entities.AppSettings.filter({ key: "reseller_settings" }).then(records => {
      if (records && records.length > 0) {
        const data = JSON.parse(records[0].value);
        setSettingsId(records[0].id);
        if (data.names) setResellerNames(data.names);
        if (data.costs) setCosts(data.costs);
      }
    });
  }, []);

  async function saveResellerSettings() {
    setSaving(true);
    const value = JSON.stringify({ names: resellerNames, costs });
    clearResellerCache();
    if (settingsId) {
      await base44.entities.AppSettings.update(settingsId, { key: "reseller_settings", value });
    } else {
      const rec = await base44.entities.AppSettings.create({ key: "reseller_settings", value });
      setSettingsId(rec.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function createWorkspace() {
    if (!newWsName.trim()) return;
    setCreatingWs(true);
    await base44.entities.SalesNavWorkspace.create({
      name: newWsName.trim(),
      description: newWsDesc.trim() || undefined,
      heyreach_api_key: newWsKey.trim() || undefined,
      color: newWsColor,
      is_default: workspaces.length === 0,
    });
    setNewWsName(""); setNewWsDesc(""); setNewWsKey(""); setNewWsColor("#6366f1");
    await refreshWorkspaces();
    setCreatingWs(false);
  }

  async function deleteWorkspace(id) {
    setDeletingWs(id);
    await base44.entities.SalesNavWorkspace.delete(id);
    await refreshWorkspaces();
    setDeletingWs(null);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure resellers and workspaces</p>
      </div>

      {/* Reseller settings */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-5">
        <h2 className="font-semibold text-foreground">Reseller Configuration</h2>
        {RESELLERS.map(r => (
          <div key={r} className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Display Name ({r})</label>
              <Input
                value={resellerNames[r] || ''}
                onChange={e => setResellerNames(n => ({ ...n, [r]: e.target.value }))}
                placeholder={`Reseller name`}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Seat Cost ($/mo)</label>
              <Input
                type="number"
                value={costs[r] || ''}
                onChange={e => setCosts(c => ({ ...c, [r]: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
          </div>
        ))}
        <Button onClick={saveResellerSettings} disabled={saving} className="gap-2">
          {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Settings'}</>}
        </Button>
      </div>

      {/* Workspace management */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Workspaces</h2>
        {workspaces.length > 0 && (
          <div className="space-y-2">
            {workspaces.map(ws => (
              <div key={ws.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ws.color || '#6366f1' }} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{ws.name}</p>
                    {ws.description && <p className="text-xs text-muted-foreground">{ws.description}</p>}
                  </div>
                  {ws.is_default && <span className="text-xs bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-full">Default</span>}
                </div>
                <button
                  onClick={() => deleteWorkspace(ws.id)}
                  disabled={deletingWs === ws.id}
                  className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Add New Workspace</p>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Workspace name *" value={newWsName} onChange={e => setNewWsName(e.target.value)} />
            <Input placeholder="Description" value={newWsDesc} onChange={e => setNewWsDesc(e.target.value)} />
          </div>
          <Input placeholder="HeyReach API key (optional, falls back to global)" value={newWsKey} onChange={e => setNewWsKey(e.target.value)} />
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Color</label>
            <input type="color" value={newWsColor} onChange={e => setNewWsColor(e.target.value)} className="w-9 h-9 rounded-lg border border-border cursor-pointer bg-transparent" />
          </div>
          <Button onClick={createWorkspace} disabled={!newWsName.trim() || creatingWs} className="gap-2">
            <Plus className="w-4 h-4" /> {creatingWs ? 'Creating…' : 'Create Workspace'}
          </Button>
        </div>
      </div>
    </div>
  );
}