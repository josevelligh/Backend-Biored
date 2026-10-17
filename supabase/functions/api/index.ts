import { createApp } from '../_shared/app.ts';

/**
 * Supabase Edge Function: `api`
 *
 * Despliegue:
 *   supabase functions deploy api
 *
 * URL resultante:
 *   https://<project-ref>.supabase.co/functions/v1/api/api/v1/...
 *
 * La app Expo consume esa URL (ver `src/api-client.ts`).
 */
const app = createApp();

Deno.serve({ onListen: () => console.log('[biored] edge function `api` lista') }, (request) =>
  app.fetch(request));
