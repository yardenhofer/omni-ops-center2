import { base44 } from "@/api/base44Client";

const DEFAULT_NAMES = {
  reseller_1: "Reseller 1",
  reseller_2: "Reseller 2",
  reseller_3: "Reseller 3",
};

const DEFAULT_COSTS = {
  reseller_1: 0,
  reseller_2: 0,
  reseller_3: 0,
};

let _cache = null;

export async function fetchResellerSettings() {
  if (_cache) return _cache;
  try {
    const records = await base44.entities.AppSettings.filter({ key: "reseller_settings" });
    if (records && records.length > 0) {
      _cache = JSON.parse(records[0].value);
      return _cache;
    }
  } catch {}
  return { names: DEFAULT_NAMES, costs: DEFAULT_COSTS };
}

export function clearResellerCache() {
  _cache = null;
}

export async function fetchResellerNames() {
  const s = await fetchResellerSettings();
  return s.names || DEFAULT_NAMES;
}