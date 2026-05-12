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

async function fetchAllAccounts(apiKey) {
  let all = [], offset = 0;
  while (true) {
    const data = await heyFetch('https://api.heyreach.io/api/public/li_account/GetAll', apiKey, { offset, limit: 100 });
    if (!data) break;
    const items = data.items || [];
    all = all.concat(items);
    if (items.length < 100) break;
    offset += 100;
  }
  return all;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date().toISOString();

    // Get all workspaces with API keys
    let workspaces = await base44.asServiceRole.entities.SalesNavWorkspace.list('-created_date', 100);
    if (!Array.isArray(workspaces)) workspaces = [];

    const globalApiKey = Deno.env.get('HEYREACH_INTERNAL_API_KEY');

    // Build list of workspace+key pairs to process
    const toProcess = [];
    for (const ws of workspaces) {
      const key = ws.heyreach_api_key || globalApiKey;
      if (key) toProcess.push({ workspace_id: ws.id, workspace_name: ws.name, api_key: key });
    }
    // If no workspaces configured but global key exists, use a default workspace
    if (toProcess.length === 0 && globalApiKey) {
      // Try to find or create a default workspace
      let defaultWs = workspaces.find(w => w.is_default);
      if (!defaultWs) {
        defaultWs = await base44.asServiceRole.entities.SalesNavWorkspace.create({
          name: 'Default',
          is_default: true,
          color: '#6366f1',
        });
      }
      toProcess.push({ workspace_id: defaultWs.id, workspace_name: 'Default', api_key: globalApiKey });
    }

    let totalSynced = 0;
    let totalDisconnected = 0;
    let totalReconnected = 0;

    for (const ws of toProcess) {
      try {
        const accounts = await fetchAllAccounts(ws.api_key);
        console.log(`Workspace ${ws.workspace_name}: ${accounts.length} accounts`);

        for (const acc of accounts) {
          const heyreachId = acc.id;
          const firstName = acc.firstName || '';
          const lastName = acc.lastName || '';
          const email = acc.email || '';
          const profileUrl = acc.profileUrl || '';
          const authIsValid = acc.status === 'ACTIVE';
          const isValidNavigator = acc.hasValidNavigator !== false; // default true unless explicitly false
          const isActive = acc.status !== 'INACTIVE';

          // Find existing record
          const existing = await base44.asServiceRole.entities.LinkedInAccount.filter({
            workspace_id: ws.workspace_id,
            heyreach_account_id: heyreachId,
          });

          const baseData = {
            workspace_id: ws.workspace_id,
            heyreach_account_id: heyreachId,
            email_address: email,
            first_name: firstName,
            last_name: lastName,
            profile_url: profileUrl,
            is_active: isActive,
            auth_is_valid: authIsValid,
            is_valid_navigator: isValidNavigator,
            last_checked_at: now,
          };

          if (existing && existing.length > 0) {
            const record = existing[0];
            const updates = { ...baseData };

            // Status transition logic
            if (!isValidNavigator && record.status === 'connected') {
              updates.status = 'disconnected';
              updates.disconnected_at = now;
              totalDisconnected++;
            } else if (isValidNavigator && record.status === 'disconnected') {
              updates.status = 'connected';
              updates.disconnected_at = null;
              totalReconnected++;
            }
            // Never overwrite in_progress or refreshed

            await base44.asServiceRole.entities.LinkedInAccount.update(record.id, updates);
          } else {
            // New account
            const status = isValidNavigator ? 'connected' : 'disconnected';
            await base44.asServiceRole.entities.LinkedInAccount.create({
              ...baseData,
              status,
              disconnected_at: !isValidNavigator ? now : null,
            });
          }
          totalSynced++;
        }
      } catch (err) {
        console.error(`Failed workspace ${ws.workspace_name}: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      synced_at: now,
      total_synced: totalSynced,
      total_disconnected: totalDisconnected,
      total_reconnected: totalReconnected,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});