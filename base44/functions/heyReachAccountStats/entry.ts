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

async function processWorkspace(ws, startDate, now) {
  let allCampaigns = [];
  let offset = 0;
  while (true) {
    const campData = await heyFetch('https://api.heyreach.io/api/public/campaign/GetAll', ws.api_key, { offset, limit: 100 });
    if (!campData) break;
    const items = campData.items || [];
    allCampaigns = allCampaigns.concat(items);
    if (items.length < 100) break;
    offset += 100;
  }

  const activeCampaigns = allCampaigns.filter(c => c.status === 'IN_PROGRESS');

  let allAccounts = [];
  let accOffset = 0;
  while (true) {
    const accData = await heyFetch('https://api.heyreach.io/api/public/li_account/GetAll', ws.api_key, { offset: accOffset, limit: 100 });
    if (!accData) break;
    const items = accData.items || [];
    allAccounts = allAccounts.concat(items);
    if (items.length < 100) break;
    accOffset += 100;
  }

  const overallStats = await heyFetch('https://api.heyreach.io/api/public/stats/GetOverallStats', ws.api_key, {
    startDate: startDate.toISOString(),
    endDate: now.toISOString(),
    accountIds: [],
    campaignIds: [],
  });

  const byDay = overallStats?.byDayStats || {};
  const chartData = Object.entries(byDay)
    .map(([date, s]) => ({
      date: date.split('T')[0],
      inmails: s.totalInmailStarted || 0,
      connections: s.connectionsSent || 0,
      connectionsAccepted: s.connectionsAccepted || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const accountStatsMap = {};
  for (const acc of allAccounts) {
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
  }

  const senderMap = {};
  for (const acc of allAccounts) {
    senderMap[acc.id] = {
      displayName: `${acc.firstName || ''} ${acc.lastName || ''}`.trim() || `Account ${acc.id}`,
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { days = 30, client_id } = body;

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

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // If a specific client_id is requested, process only that one
    if (client_id) {
      const ws = allWorkspaces.find(w => w.client_id === client_id);
      if (!ws) {
        return Response.json({ error: 'Workspace not found' }, { status: 404 });
      }
      try {
        const result = await processWorkspace(ws, startDate, now);
        return Response.json({ workspace: result, workspace_list: null });
      } catch (err) {
        return Response.json({
          workspace: {
            client_id: ws.client_id,
            client_name: ws.client_name,
            error: err?.message || String(err),
            accounts: [], campaigns: [], chartData: [], summary: null,
          },
          workspace_list: null,
        });
      }
    }

    // No client_id: return just the list of workspaces (id + name) so the frontend
    // knows what to fetch, without fetching any data yet
    return Response.json({
      workspace: null,
      workspace_list: allWorkspaces.map(w => ({ client_id: w.client_id, client_name: w.client_name })),
    });

  } catch (topErr) {
    return Response.json({ error: topErr?.message }, { status: 500 });
  }
});