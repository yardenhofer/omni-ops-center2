import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Build list of workspaces: internal key first, then any client keys
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

    const workspaces = [];

    for (const ws of allWorkspaces) {
      try {
        // Fetch all campaigns (paginated)
        let allCampaigns = [];
        let offset = 0;
        const limit = 100;
        while (true) {
          const campResp = await fetch('https://api.heyreach.io/api/public/campaign/GetAll', {
            method: 'POST',
            headers: {
              'X-API-KEY': ws.api_key,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ offset, limit }),
          });
          if (!campResp.ok) break;
          const campData = await campResp.json();
          const items = campData.items || [];
          allCampaigns = allCampaigns.concat(items);
          if (items.length < limit) break;
          offset += limit;
        }

        const activeCampaigns = allCampaigns.filter(c => c.status === 'IN_PROGRESS');

        // Derive sender accounts from campaign names: "SenderName - CampaignType Date"
        // Each campaign's accountIds list is in campaignAccountIds
        const senderMap = {};
        for (const camp of activeCampaigns) {
          const dashIdx = camp.name.indexOf(' - ');
          const senderName = dashIdx > 0 ? camp.name.slice(0, dashIdx).trim() : camp.name;
          if (!senderMap[senderName]) {
            senderMap[senderName] = { total_leads: 0, finished_leads: 0, in_progress: 0, campaigns: [] };
          }
          senderMap[senderName].total_leads += camp.progressStats?.totalUsers || 0;
          senderMap[senderName].finished_leads += camp.progressStats?.totalUsersFinished || 0;
          senderMap[senderName].in_progress += camp.progressStats?.totalUsersInProgress || 0;
          senderMap[senderName].campaigns.push(camp.name);
        }

        const accounts = Object.entries(senderMap)
          .map(([name, stats]) => ({
            name,
            total_leads: stats.total_leads,
            finished_leads: stats.finished_leads,
            in_progress: stats.in_progress,
            completion_pct: stats.total_leads > 0 ? Math.round((stats.finished_leads / stats.total_leads) * 100) : 0,
          }))
          .sort((a, b) => b.total_leads - a.total_leads);

        // Overall summary
        let totalUsers = 0, totalFinished = 0, totalInProgress = 0;
        for (const camp of activeCampaigns) {
          totalUsers += camp.progressStats?.totalUsers || 0;
          totalFinished += camp.progressStats?.totalUsersFinished || 0;
          totalInProgress += camp.progressStats?.totalUsersInProgress || 0;
        }
        const completionPct = totalUsers > 0 ? Math.round((totalFinished / totalUsers) * 100) : null;

        workspaces.push({
          client_id: ws.client_id,
          client_name: ws.client_name,
          accounts,
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
            completion_pct: completionPct,
            total_leads: totalUsers,
            total_finished: totalFinished,
            total_in_progress: totalInProgress,
          },
        });

      } catch (err) {
        workspaces.push({
          client_id: ws.client_id,
          client_name: ws.client_name,
          error: err?.message || String(err),
          accounts: [],
          campaigns: [],
          summary: null,
        });
      }
    }

    return Response.json({ success: true, workspaces });

  } catch (topErr) {
    return Response.json({ error: topErr?.message }, { status: 500 });
  }
});