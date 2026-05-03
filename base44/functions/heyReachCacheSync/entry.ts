import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function heyFetch(url, apiKey, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    console.error(`heyFetch ${url} → ${resp.status}`);
    return null;
  }
  return resp.json();
}

async function fetchAllPages(url, apiKey, bodyFn) {
  let all = [], offset = 0;
  while (true) {
    const data = await heyFetch(url, apiKey, bodyFn(offset));
    if (!data) break;
    const items = data.items || [];
    all = all.concat(items);
    if (items.length < 100) break;
    offset += 100;
  }
  return all;
}

// Sum byDayStats entries that fall within the last N days
// byDayStats keys are date strings like "2026-05-02" or "2026-05-02T00:00:00Z"
function sumByDay(byDay, days, now) {
  // Use timestamp cutoff: go back N full days from now
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  let inmails = 0, connections = 0, connectionsAccepted = 0;
  const chartMap = {};
  for (const [dateStr, s] of Object.entries(byDay)) {
    const key = dateStr.split('T')[0];
    // Parse date as UTC noon to avoid timezone boundary issues
    const d = new Date(key + 'T12:00:00Z');
    if (d < cutoff) continue;
    inmails += s.totalInmailStarted || 0;
    connections += s.connectionsSent || 0;
    connectionsAccepted += s.connectionsAccepted || 0;
    chartMap[key] = {
      date: key,
      inmails: (chartMap[key]?.inmails || 0) + (s.totalInmailStarted || 0),
      connections: (chartMap[key]?.connections || 0) + (s.connectionsSent || 0),
      connectionsAccepted: (chartMap[key]?.connectionsAccepted || 0) + (s.connectionsAccepted || 0),
    };
  }
  const chartData = Object.values(chartMap).sort((a, b) => a.date.localeCompare(b.date));
  return { inmails, connections, connectionsAccepted, chartData };
}

const ALL_DAYS = [1, 7, 14, 30, 60, 90];
const MAX_DAYS = 90;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const syncedAt = now.toISOString();
    const startDate90 = new Date(now.getTime() - MAX_DAYS * 24 * 60 * 60 * 1000);
    let totalWritten = 0;

    let clients = await base44.asServiceRole.entities.Client.list('-updated_date', 200);
    if (!Array.isArray(clients)) clients = clients?.items || clients?.data || [];
    const clientWorkspaces = clients
      .filter(c => c.heyreach_api_key && c.status !== 'Terminated')
      .map(c => ({ client_id: c.id, client_name: c.name, api_key: c.heyreach_api_key }));

    const internalKey = Deno.env.get('HEYREACH_INTERNAL_API_KEY');
    const allWorkspaces = [
      ...(internalKey ? [{ client_id: '__internal__', client_name: 'Omni Internal', api_key: internalKey }] : []),
      ...clientWorkspaces,
    ];

    for (const ws of allWorkspaces) {
      try {
        // Fetch campaigns & accounts ONCE per workspace
        const [allCampaigns, allAccounts] = await Promise.all([
          fetchAllPages('https://api.heyreach.io/api/public/campaign/GetAll', ws.api_key, (offset) => ({ offset, limit: 100 })),
          fetchAllPages('https://api.heyreach.io/api/public/li_account/GetAll', ws.api_key, (offset) => ({ offset, limit: 100 })),
        ]);
        console.log(`${ws.client_name}: ${allAccounts.length} accounts, ${allCampaigns.length} campaigns`);

        const activeCampaigns = allCampaigns.filter(c => c.status === 'IN_PROGRESS');

        // Detect disconnected accounts (status !== 'ACTIVE')
        const disconnectedAccounts = allAccounts
          .filter(a => a.status && a.status !== 'ACTIVE')
          .map(a => ({
            id: a.id,
            name: `${a.firstName || ''} ${a.lastName || ''}`.trim() || `Account ${a.id}`,
            status: a.status,
          }));

        // Fetch overall 90d stats ONCE (for chart data slicing per period)
        const overallStats90 = await heyFetch('https://api.heyreach.io/api/public/stats/GetOverallStats', ws.api_key, {
          startDate: startDate90.toISOString(),
          endDate: now.toISOString(),
          accountIds: [],
          campaignIds: [],
        });
        const overallByDay = overallStats90?.byDayStats || {};

        // Fetch per-account 90d stats ONCE, sequentially to avoid rate limits
        const accountByDay = {};
        const accountIdToName = {};
        for (const acc of allAccounts) {
          accountIdToName[acc.id] = `${acc.firstName || ''} ${acc.lastName || ''}`.trim() || `Account ${acc.id}`;
          const sd = await heyFetch('https://api.heyreach.io/api/public/stats/GetOverallStats', ws.api_key, {
            startDate: startDate90.toISOString(),
            endDate: now.toISOString(),
            accountIds: [acc.id],
            campaignIds: [],
          });
          accountByDay[acc.id] = sd?.byDayStats || {};
          await new Promise(r => setTimeout(r, 100));
        }
        console.log(`${ws.client_name}: fetched per-account stats`);

        // Now build cache for each day period by slicing the 90d data
        for (const days of ALL_DAYS) {
          try {
            // Overall chart + totals for this period
            const overallSlice = sumByDay(overallByDay, days, now);

            // Per-account stats for this period
            const accountStatsMap = {};
            for (const acc of allAccounts) {
              accountStatsMap[acc.id] = sumByDay(accountByDay[acc.id] || {}, days, now);
            }

            // Build senderMap
            const senderMap = {};
            for (const acc of allAccounts) {
              senderMap[acc.id] = {
                displayName: accountIdToName[acc.id],
                total_leads: 0, finished_leads: 0, in_progress: 0,
                inmails: accountStatsMap[acc.id].inmails,
                connections: accountStatsMap[acc.id].connections,
                connectionsAccepted: accountStatsMap[acc.id].connectionsAccepted,
              };
            }

            for (const camp of activeCampaigns) {
              const accountIds = camp.campaignAccountIds || [];
              for (const accId of accountIds) {
                if (senderMap[accId]) {
                  const divisor = accountIds.length || 1;
                  senderMap[accId].total_leads += Math.round((camp.progressStats?.totalUsers || 0) / divisor);
                  senderMap[accId].finished_leads += Math.round((camp.progressStats?.totalUsersFinished || 0) / divisor);
                  senderMap[accId].in_progress += Math.round((camp.progressStats?.totalUsersInProgress || 0) / divisor);
                }
              }
            }

            const accounts = Object.entries(senderMap)
              .map(([, stats]) => ({
                name: stats.displayName,
                total_leads: stats.total_leads,
                finished_leads: stats.finished_leads,
                in_progress: stats.in_progress,
                completion_pct: stats.total_leads > 0 ? Math.round((stats.finished_leads / stats.total_leads) * 100) : 0,
                inmails: stats.inmails,
                connections: stats.connections,
                connections_accepted: stats.connectionsAccepted,
              }))
              .sort((a, b) => b.inmails - a.inmails);

            let totalUsers = 0, totalFinished = 0, totalInProgress = 0;
            for (const camp of activeCampaigns) {
              totalUsers += camp.progressStats?.totalUsers || 0;
              totalFinished += camp.progressStats?.totalUsersFinished || 0;
              totalInProgress += camp.progressStats?.totalUsersInProgress || 0;
            }

            const wsData = {
              client_id: ws.client_id,
              client_name: ws.client_name,
              disconnectedAccounts,
              accounts,
              chartData: overallSlice.chartData,
              campaigns: activeCampaigns.map(c => ({
                id: c.id,
                name: c.name,
                completion_pct: c.progressStats?.totalUsers > 0
                  ? Math.round((c.progressStats.totalUsersFinished / c.progressStats.totalUsers) * 100)
                  : 0,
                total_leads: c.progressStats?.totalUsers || 0,
                finished_leads: c.progressStats?.totalUsersFinished || 0,
                in_progress: c.progressStats?.totalUsersInProgress || 0,
              })),
              summary: {
                active_campaigns: activeCampaigns.length,
                total_campaigns: allCampaigns.length,
                total_accounts: accounts.length,
                completion_pct: totalUsers > 0 ? Math.round((totalFinished / totalUsers) * 100) : null,
                total_leads: totalUsers,
                total_finished: totalFinished,
                total_in_progress: totalInProgress,
                total_inmails: overallSlice.inmails,
                total_connections: overallSlice.connections,
                total_connections_accepted: overallSlice.connectionsAccepted,
              },
            };

            const cacheKey = `${ws.client_id}_${days}`;
            const existing = await base44.asServiceRole.entities.HeyReachCache.filter({ cache_key: cacheKey });
            const payload = {
              cache_key: cacheKey,
              client_id: ws.client_id,
              days,
              workspace_data: JSON.stringify(wsData),
              synced_at: syncedAt,
            };

            if (existing && existing.length > 0) {
              await base44.asServiceRole.entities.HeyReachCache.update(existing[0].id, payload);
            } else {
              await base44.asServiceRole.entities.HeyReachCache.create(payload);
            }
            totalWritten++;
            console.log(`Cached ${ws.client_name} / ${days}d: ${accounts.length} senders, inmails=${overallSlice.inmails}`);
          } catch (err) {
            console.error(`Failed ${ws.client_id} / ${days}d: ${err.message}`);
          }
        }
      } catch (err) {
        console.error(`Failed workspace ${ws.client_id}: ${err.message}`);
      }
    }

    return Response.json({ success: true, synced_at: syncedAt, total_written: totalWritten });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});