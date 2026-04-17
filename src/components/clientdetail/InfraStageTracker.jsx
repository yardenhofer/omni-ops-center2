import { base44 } from "@/api/base44Client";
import { differenceInDays } from "date-fns";
import { Server, ChevronRight, Check } from "lucide-react";

const STAGES = [
  "Infrastructure Ordered",
  "Infrastructure In Process",
  "Infrastructure Uploaded",
  "Infrastructure Live",
];

export function isInfraStageVisible(client) {
  if (!client.infra_stage) return false;
  if (client.infra_stage === "Infrastructure Live" && client.infra_live_date) {
    const days = differenceInDays(new Date(), new Date(client.infra_live_date + "T00:00:00"));
    if (days >= 2) return false;
  }
  return true;
}

export default function InfraStageTracker({ client, onClientUpdate }) {
  if (!isInfraStageVisible(client)) return null;

  const currentIndex = STAGES.indexOf(client.infra_stage);

  async function setStage(stage) {
    const updates = { infra_stage: stage };
    if (stage === "Infrastructure Live" && !client.infra_live_date) {
      updates.infra_live_date = new Date().toISOString().slice(0, 10);
    }
    await base44.entities.Client.update(client.id, updates);
    onClientUpdate(updates);
  }

  async function clearStage() {
    await base44.entities.Client.update(client.id, { infra_stage: null, infra_live_date: null });
    onClientUpdate({ infra_stage: null, infra_live_date: null });
  }

  const isLive = client.infra_stage === "Infrastructure Live";
  const daysLive = isLive && client.infra_live_date
    ? differenceInDays(new Date(), new Date(client.infra_live_date + "T00:00:00"))
    : null;

  return (
    <div className={`rounded-xl border p-4 ${
      isLive
        ? "bg-green-500/5 border-green-500/20"
        : "bg-violet-500/5 border-violet-500/20"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className={`w-4 h-4 ${isLive ? "text-green-400" : "text-violet-400"}`} />
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Infrastructure Setup</h3>
          {isLive && daysLive !== null && (
            <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
              Live · disappears in {Math.max(0, 2 - daysLive)}d
            </span>
          )}
        </div>
        <button
          onClick={clearStage}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Stage pipeline */}
      <div className="flex items-center gap-1 flex-wrap">
        {STAGES.map((stage, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const isLiveStage = stage === "Infrastructure Live";

          return (
            <div key={stage} className="flex items-center gap-1">
              <button
                onClick={() => setStage(stage)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all ${
                  active
                    ? isLiveStage
                      ? "bg-green-500 border-green-500 text-white shadow-sm shadow-green-500/30"
                      : "bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-500/30"
                    : done
                      ? "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500"
                      : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-500"
                }`}
              >
                {done && <Check className="w-3 h-3" />}
                {stage}
              </button>
              {i < STAGES.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}