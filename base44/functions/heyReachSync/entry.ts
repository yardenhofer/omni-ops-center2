import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow admin users or service-role calls
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    } catch (_) {
      // service-role call, allow
    }

    let body = {};
    try { body = await req.clone().json(); } catch (_) {}
    const singleClientId = body.client_id || null;

    // Fetch clients
    let clients;
    if (singleClientId) {
      clients = await base44.asServiceRole.entities.Client.filter({ id: singleClientId }, '-updated_date', 1);
    } else {
      clients = await base44.asServiceRole.entities.Client.list('-updated_date', 200);
    }
    if (!Array.isArray(clients)) clients = clients?.items || clients?.data || [];

    const eligible = clients.filter(c => c.heyreach_api_key && c.status !== 'Terminated');
    console.log(`HeyReach sync: ${eligible.length} clients with API keys`);

    const results = [];
    const errors = [];

    for (const client of eligible) {
      try {
        // Fetch all campaigns (paginated, up to 100 per request)
        let allCampaigns = [];
        let offset = 0;
        const limit = 100;

        while (true) {
          const resp = await fetch('https://api.heyreach.io/api/public/campaign/GetAll', {
            method: 'POST',
            headers: {
              'X-API-KEY': client.heyreach_api_key,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ offset, limit }),
          });

          if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`HeyReach API error ${resp.status}: ${errText}`);
          }

          const data = await resp.json();
          const items = data.items || [];
          allCampaigns = allCampaigns.concat(items);
          if (items.length < limit) break;
          offset += limit;
        }

        // Filter to active campaigns only (IN_PROGRESS)
        const activeCampaigns = allCampaigns.filter(c => c.status === 'IN_PROGRESS');

        let cacheUpdate = {};

        if (allCampaigns.length === 0 || activeCampaigns.length === 0) {
          cacheUpdate = {
            heyreach_cache_pct: null,
            heyreach_cache_no_active: true,
            heyreach_cache_error: null,
            heyreach_cache_updated: new Date().toISOString(),
          };
        } else {
          // Compute overall completion % across all active campaigns
          // % = totalUsersFinished / totalUsers * 100
          let totalUsers = 0;
          let totalFinished = 0;

          for (const campaign of activeCampaigns) {
            const stats = campaign.progressStats;
            if (stats) {
              totalUsers += stats.totalUsers || 0;
              totalFinished += stats.totalUsersFinished || 0;
            }
          }

          const pct = totalUsers > 0 ? Math.round((totalFinished / totalUsers) * 100) : 0;

          cacheUpdate = {
            heyreach_cache_pct: pct,
            heyreach_cache_no_active: false,
            heyreach_cache_error: null,
            heyreach_cache_updated: new Date().toISOString(),
          };
        }

        await base44.asServiceRole.entities.Client.update(client.id, cacheUpdate);
        console.log(`OK ${client.name}: ${cacheUpdate.heyreach_cache_pct ?? 'N/A'}% (${activeCampaigns.length} active campaigns)`);
        results.push({ client: client.name, ...cacheUpdate });

      } catch (err) {
        const errMsg = err?.message || String(err);
        console.error(`FAIL ${client.name}: ${errMsg}`);
        await base44.asServiceRole.entities.Client.update(client.id, {
          heyreach_cache_error: errMsg,
          heyreach_cache_updated: new Date().toISOString(),
        });
        errors.push({ client: client.name, error: errMsg });
      }
    }

    return Response.json({
      success: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
    });

  } catch (topErr) {
    console.error('Top-level error:', topErr?.message);
    return Response.json({ error: topErr?.message }, { status: 500 });
  }
});