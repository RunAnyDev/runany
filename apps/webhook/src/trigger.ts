import type { PublishPayload, TriggerResponse } from '@runany/shared';

const VERCEL_DEPLOY_HOOK_URL = process.env.VERCEL_DEPLOY_HOOK_URL || '';

export async function triggerRebuild(): Promise<TriggerResponse> {
  if (!VERCEL_DEPLOY_HOOK_URL) {
    return { triggered: false, message: 'VERCEL_DEPLOY_HOOK_URL not configured' };
  }

  const response = await fetch(VERCEL_DEPLOY_HOOK_URL, {
    method: 'POST',
  });

  if (!response.ok) {
    return { triggered: false, message: `Failed with status ${response.status}` };
  }

  return { triggered: true, message: 'Rebuild triggered successfully' };
}