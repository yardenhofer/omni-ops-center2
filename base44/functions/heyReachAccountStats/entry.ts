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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { days = 30 } = body; // time period in days

    // Build list of workspaces
    let clients = await base44.asServiceRole.entities.Client.list('-updated_date', 200);
    if (!Array.isArray(clients)) clients = clients?.items || clients?.data || [];
    const clientWorkspaces = clients
      .filter(c => c.heyreach_api_key && c.status !== 'Terminated')
      .map(c => ({ client_id: c.id, client_name: c.name, api_key: c.heyreach_api_key }));

    const internalKey = Deno.env.get('HEYREACH_INTERNAL_API_KEY');
    const allWorkspaces = [
      ...(internalKey ? [{ client_id: '__internal__', client_name: 'GBV Internal', api_key: internalKey }] : []),
      ...clientWorkspaces,
    ];

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const workspaces = [];

    for (const ws of allWorkspaces) {
      try {
        // 1. Fetch all campaigns (paginated)
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

        // 2. Fetch all LinkedIn accounts
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

        // 3. Fetch overall stats for the period (all accounts combined) for chart data
        const overallStats = await heyFetch('https://api.heyreach.io/api/public/stats/GetOverallStats', ws.api_key, {
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          accountIds: [],
          campaignIds: [],
        });

        // Build daily chart data from byDayStats
        const byDay = overallStats?.byDayStats || {};
        const chartData = Object.entries(byDay)
          .map(([date, s]) => ({
            date: date.split('T')[0],
            inmails: s.inmailMessagesSent || 0,
            connections: s.connectionsSent || 0,
            connectionsAccepted: s.connectionsAccepted || 0,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // 4. Per-account stats (InMails + connections) — fetch in parallel batches of 5
        const accountStatsMap = {};
        const batchSize = 5;
        for (let i = 0; i < allAccounts.length; i += batchSize) {
          const batch = allAccounts.slice(i, i + batchSize);
          await Promise.all(batch.map(async (acc) => {
            const sd = await heyFetch('https://api.heyreach.io/api/public/stats/GetOverallStats', ws.api_key, {
              startDate: startDate.toISOString(),
              endDate: now.toISOString(),
              accountIds: [acc.id],
              campaignIds: [],
            });
            let inmails = 0, connections = 0, connectionsAccepted = 0;
            for (const day of Object.values(sd?.byDayStats || {})) {
              inmails += day.inmailMessagesSent || 0;
              connections += day.connectionsSent || 0;
              connectionsAccepted += day.connectionsAccepted || 0;
            }
            accountStatsMap[acc.id] = { inmails, connections, connectionsAccepted };
          }));
        }

        // 5. Build per-sender data merging campaign progress + account stats
        const senderMap = {};
        for (const camp of activeCampaigns) {
          const dashIdx = camp.name.indexOf(' - ');
          const senderName = dashIdx > 0 ? camp.name.slice(0, dashIdx).trim() : camp.name;
          if (!senderMap[senderName]) {
            senderMap[senderName] = { total_leads: 0, finished_leads: 0, in_progress: 0, account_ids: new Set() };
          }
          senderMap[senderName].total_leads += camp.progressStats?.totalUsers || 0;
          senderMap[senderName].finished_leads += camp.progressStats?.totalUsersFinished || 0;
          senderMap[senderName].in_progress += camp.progressStats?.totalUsersInProgress || 0;
          (camp.campaignAccountIds || []).forEach(id => senderMap[senderName].account_ids.add(id));
        }

        // Also add accounts that have stats even if not in active campaigns
        for (const acc of allAccounts) {
          const accStats = accountStatsMap[acc.id];
          if (!accStats) continue;
          // Try to match by name
          const name = acc.name || `Account ${acc.id}`;
          // Find a matching sender or create one
          let matched = null;
          for (const [sName, s] of Object.entries(senderMap)) {
            if (s.account_ids.has(acc.id)) { matched = sName; break; }
            // fuzzy: sender name matches start of account name or vice versa
            if (name.toLowerCase().startsWith(sName.toLowerCase()) || sName.toLowerCase().startsWith(name.toLowerCase().split(' ')[0])) {
              matched = sName; break;
            }
          }
          if (!matched) {
            matched = name;
            if (!senderMap[matched]) senderMap[matched] = { total_leads: 0, finished_leads: 0, in_progress: 0, account_ids: new Set() };
          }
          if (!senderMap[matched].inmails) {
            senderMap[matched].inmails = 0;
            senderMap[matched].connections = 0;
            senderMap[matched].connectionsAccepted = 0;
          }
          senderMap[matched].inmails += accStats.inmails;
          senderMap[matched].connections += accStats.connections;
          senderMap[matched].connectionsAccepted += accStats.connectionsAccepted;
          senderMap[matched].account_ids.add(acc.id);
        }

        const accounts = Object.entries(senderMap)
          .map(([name, stats]) => ({
            name,
            total_leads: stats.total_leads,
            finished_leads: stats.finished_leads,
            in_progress: stats.in_progress,
            completion_pct: stats.total_leads > 0 ? Math.round((stats.finished_leads / stats.total_leads) * 100) : 0,
            inmails: stats.inmails || 0,
            connections: stats.connections || 0,
            connections_accepted: stats.connectionsAccepted || 0,
          }))
          .sort((a, b) => b.total_leads - a.total_leads);

        // Overall summary
        let totalUsers = 0, totalFinished = 0, totalInProgress = 0;
        let totalInmails = 0, totalConnections = 0, totalConnectionsAccepted = 0;
        for (const camp of activeCampaigns) {
          totalUsers += camp.progressStats?.totalUsers || 0;
          totalFinished += camp.progressStats?.totalUsersFinished || 0;
          totalInProgress += camp.progressStats?.totalUsersInProgress || 0;
        }
        for (const day of Object.values(byDay)) {
          totalInmails += day.inmailMessagesSent || 0;
          totalConnections += day.connectionsSent || 0;
          totalConnectionsAccepted += day.connectionsAccepted || 0;
        }

        workspaces.push({
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
        });

      } catch (err) {
        workspaces.push({
          client_id: ws.client_id,
          client_name: ws.client_name,
          error: err?.message || String(err),
          accounts: [],
          campaigns: [],
          chartData: [],
          summary: null,
        });
      }
    }

    return Response.json({ success: true, workspaces });

  } catch (topErr) {
    return Response.json({ error: topErr?.message }, { status: 500 });
  }
});