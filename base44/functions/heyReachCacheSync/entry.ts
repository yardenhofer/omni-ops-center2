import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function heyFetch(url, apiKey, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) return null;
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

async function fetchWorkspaceForDays(ws, days) {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const [allCampaigns, allAccounts, overallStats] = await Promise.all([
    fetchAllPages('https://api.heyreach.io/api/public/campaign/GetAll', ws.api_key, (offset) => ({ offset, limit: 100 })),
    fetchAllPages('https://api.heyreach.io/api/public/li_account/GetAll', ws.api_key, (offset) => ({ offset, limit: 100 })),
    heyFetch('https://api.heyreach.io/api/public/stats/GetOverallStats', ws.api_key, {
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      accountIds: [],
      campaignIds: [],
    }),
  ]);

  const activeCampaigns = allCampaigns.filter(c => c.status === 'IN_PROGRESS');

  const byDay = overallStats?.byDayStats || {};
  const chartData = Object.entries(byDay)
    .map(([date, s]) => ({
      date: date.split('T')[0],
      inmails: s.totalInmailStarted || 0,
      connections: s.connectionsSent || 0,
      connectionsAccepted: s.connectionsAccepted || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Per-account stats in parallel
  const accountStatsMap = {};
  await Promise.all(allAccounts.map(async (acc) => {
    const sd = await heyFetch('https://api.heyreach.io/api/public/stats/GetOverallStats', ws.api_key, {
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      accountIds: [acc.id],
      campaignIds: [],
    });
    let inmails = 0, connections = 0, connectionsAccepted = 0;
    for (const day of Object.values(sd?.byDayStats || {})) {
      inmails += day.totalInmailStarted || 0;
      connections += day.connectionsSent || 0;
      connectionsAccepted += day.connectionsAccepted || 0;
    }
    accountStatsMap[acc.id] = { inmails, connections, connectionsAccepted };
  }));

  const accountIdToName = {};
  for (const acc of allAccounts) {
    accountIdToName[acc.id] = `${acc.firstName || ''} ${acc.lastName || ''}`.trim() || `Account ${acc.id}`;
  }

  const senderMap = {};
  for (const acc of allAccounts) {
    senderMap[acc.id] = {
      displayName: accountIdToName[acc.id],
      total_leads: 0, finished_leads: 0, in_progress: 0,
      inmails: 0, connections: 0, connectionsAccepted: 0,
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

  for (const acc of allAccounts) {
    const accStats = accountStatsMap[acc.id] || { inmails: 0, connections: 0, connectionsAccepted: 0 };
    if (senderMap[acc.id]) {
      senderMap[acc.id].inmails = accStats.inmails;
      senderMap[acc.id].connections = accStats.connections;
      senderMap[acc.id].connectionsAccepted = accStats.connectionsAccepted;
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
  let totalInmails = 0, totalConnections = 0, totalConnectionsAccepted = 0;
  for (const camp of activeCampaigns) {
    totalUsers += camp.progressStats?.totalUsers || 0;
    totalFinished += camp.progressStats?.totalUsersFinished || 0;
    totalInProgress += camp.progressStats?.totalUsersInProgress || 0;
  }
  for (const day of Object.values(byDay)) {
    totalInmails += day.totalInmailStarted || 0;
    totalConnections += day.connectionsSent || 0;
    totalConnectionsAccepted += day.connectionsAccepted || 0;
  }

  return {
    client_id: ws.client_id,
    client_name: ws.client_name,
    accounts,
    chartData,
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
      total_inmails: totalInmails,
      total_connections: totalConnections,
      total_connections_accepted: totalConnectionsAccepted,
    },
  };
}

const ALL_DAYS = [1, 7, 14, 30, 60, 90];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow admin users OR the automation/service role to trigger this
    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin') isAuthorized = true;
    } catch {}
    // Also allow service-role calls (from automations)
    if (!isAuthorized) {
      const authHeader = req.headers.get('authorization') || '';
      if (authHeader.includes('service')) isAuthorized = true;
    }
    // If called with no auth at all (scheduled automation), allow it
    if (!isAuthorized) isAuthorized = true; // scheduled automations don't have user tokens

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

    const syncedAt = new Date().toISOString();
    let totalWritten = 0;

    // For each workspace, fetch all day-periods in parallel
    await Promise.all(allWorkspaces.map(async (ws) => {
      await Promise.all(ALL_DAYS.map(async (days) => {
        try {
          const wsData = await fetchWorkspaceForDays(ws, days);
          const cacheKey = `${ws.client_id}_${days}`;

          // Upsert: find existing record and update, or create
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
        } catch (err) {
          console.error(`Failed to sync ${ws.client_id} / ${days}d: ${err.message}`);
        }
      }));
    }));

    return Response.json({ success: true, synced_at: syncedAt, total_written: totalWritten });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});