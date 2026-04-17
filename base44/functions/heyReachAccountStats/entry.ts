import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all clients with a HeyReach API key
    let clients = await base44.asServiceRole.entities.Client.list('-updated_date', 200);
    if (!Array.isArray(clients)) clients = clients?.items || clients?.data || [];
    const eligible = clients.filter(c => c.heyreach_api_key && c.status !== 'Terminated');

    const workspaces = [];

    for (const client of eligible) {
      try {
        // 1. Fetch all LinkedIn sender accounts for this workspace
        const accountsResp = await fetch('https://api.heyreach.io/api/public/linkedin-account/GetAll', {
          method: 'POST',
          headers: {
            'X-API-KEY': client.heyreach_api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ offset: 0, limit: 100 }),
        });

        let accounts = [];
        if (accountsResp.ok) {
          const accountsData = await accountsResp.json();
          accounts = accountsData.items || accountsData || [];
        }

        // 2. Fetch all campaigns
        let allCampaigns = [];
        let offset = 0;
        const limit = 100;
        while (true) {
          const campResp = await fetch('https://api.heyreach.io/api/public/campaign/GetAll', {
            method: 'POST',
            headers: {
              'X-API-KEY': client.heyreach_api_key,
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

        // 3. Compute per-account inmail totals from campaigns
        const accountInmailMap = {};
        for (const campaign of allCampaigns) {
          const senders = campaign.linkedInAccountIds || campaign.linkedinAccountIds || [];
          const inmails = campaign.stats?.inMailsSent || campaign.progressStats?.inMailsSent || 0;
          const perSender = senders.length > 0 ? Math.round(inmails / senders.length) : 0;
          for (const accountId of senders) {
            accountInmailMap[accountId] = (accountInmailMap[accountId] || 0) + perSender;
          }
        }

        // 4. Overall campaign completion %
        let totalUsers = 0, totalFinished = 0, totalInmails = 0;
        for (const camp of activeCampaigns) {
          const stats = camp.progressStats;
          if (stats) {
            totalUsers += stats.totalUsers || 0;
            totalFinished += stats.totalUsersFinished || 0;
            totalInmails += stats.inMailsSent || 0;
          }
        }
        const completionPct = totalUsers > 0 ? Math.round((totalFinished / totalUsers) * 100) : null;

        workspaces.push({
          client_id: client.id,
          client_name: client.name,
          accounts: accounts.map(a => ({
            id: a.id || a.accountId,
            name: a.name || a.fullName || a.email || 'Unknown',
            email: a.email || null,
            profile_url: a.profileUrl || null,
            status: a.status || a.accountStatus || 'Unknown',
            inmails_sent: accountInmailMap[a.id || a.accountId] || 0,
          })),
          campaigns: activeCampaigns.map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
            completion_pct: c.progressStats?.totalUsers > 0
              ? Math.round((c.progressStats.totalUsersFinished / c.progressStats.totalUsers) * 100)
              : 0,
            total_leads: c.progressStats?.totalUsers || 0,
            finished_leads: c.progressStats?.totalUsersFinished || 0,
            inmails_sent: c.progressStats?.inMailsSent || 0,
          })),
          summary: {
            active_campaigns: activeCampaigns.length,
            total_campaigns: allCampaigns.length,
            total_accounts: accounts.length,
            completion_pct: completionPct,
            total_inmails_sent: totalInmails,
          },
        });

      } catch (err) {
        workspaces.push({
          client_id: client.id,
          client_name: client.name,
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