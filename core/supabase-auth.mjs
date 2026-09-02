// Builds the correct Supabase REST/RPC auth headers for either key format
// this project may be given:
//
//   - legacy service_role/anon keys: JWTs, always start with "eyJ".
//     PostgREST decodes these as a JWT to resolve the Postgres role, so
//     they must be sent as both `apikey` and `Authorization: Bearer`.
//   - newer Supabase API keys ("sb_secret_...", "sb_publishable_..."):
//     not JWTs. Sending one as `Authorization: Bearer <key>` makes the
//     gateway try to parse it as a JWT and reject it ("Invalid JWT").
//     Only the `apikey` header is needed.
//
// Never log, print, or echo the key value anywhere in this module.

/** @param {string} key */
export function isSupabaseNewFormatKey(key) {
  return typeof key === 'string' && key.startsWith('sb_');
}

/**
 * @param {string} key
 * @returns {Record<string, string>}
 */
export function supabaseAuthHeaders(key) {
  if (!key) throw new Error('A Supabase key is required to build auth headers.');
  if (isSupabaseNewFormatKey(key)) return { apikey: key };
  return { apikey: key, authorization: `Bearer ${key}` };
}

/**
 * Prefers the newer SUPABASE_SECRET_KEY when a caller has set it, falling
 * back to the legacy SUPABASE_SERVICE_ROLE_KEY so existing deployments
 * that only have the legacy key configured keep working unchanged.
 * @param {Record<string, string | undefined>} [env]
 */
export function resolveSupabaseServiceKey(env = process.env) {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
}
