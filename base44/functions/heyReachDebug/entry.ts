import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function heyFetch(url, apiKey, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  return { ok: resp.ok, status: resp.status, body: text };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const apiKey = Deno.env.get('HEYREACH_INTERNAL_API_KEY');
    const days = 30;
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // 1. Get all accounts
    const accResp = await heyFetch('https://api.heyreach.io/api/public/li_account/GetAll', apiKey, { offset: 0, limit: 100 });
    let accounts = [];
    try { accounts = JSON.parse(accResp.body)?.items || []; } catch {}

    // Find Peter
    const peterAcc = accounts.find(a => (a.firstName || '').toLowerCase().includes('peter'));
    if (!peterAcc) {
      return Response.json({ error: 'Peter not found', allNames: accounts.map(a => `${a.firstName} ${a.lastName}`) });
    }

    const results = [];
    for (const acc of [peterAcc]) {
      const statsResp = await heyFetch('https://api.heyreach.io/api/public/stats/GetOverallStats', apiKey, {
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        accountIds: [acc.id],
        campaignIds: [],
      });

      let parsed = null;
      let inmails = 0, connections = 0;
      try {
        parsed = JSON.parse(statsResp.body);
        for (const day of Object.values(parsed?.byDayStats || {})) {
          inmails += day.totalInmailStarted || 0;
          connections += day.connectionsSent || 0;
        }
      } catch {}

      results.push({
        id: acc.id,
        name: `${acc.firstName || ''} ${acc.lastName || ''}`.trim(),
        statsHttpStatus: statsResp.status,
        statsOk: statsResp.ok,
        byDayCount: parsed?.byDayStats ? Object.keys(parsed.byDayStats).length : 0,
        inmails,
        connections,
        rawStatsSnippet: statsResp.body.slice(0, 500),
      });
    }

    return Response.json({ accounts: results, startDate: startDate.toISOString(), endDate: now.toISOString() });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});