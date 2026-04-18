import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, user_id, data } = body;

  // Update a user — admin only
  if (action === 'update' && user_id && data) {
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    const updated = await base44.asServiceRole.entities.User.update(user_id, data);
    return Response.json({ user: updated });
  }

  // Default: list users — all authenticated users allowed
  const users = await base44.asServiceRole.entities.User.list("-created_date", 200);
  return Response.json({ users });
});