import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Single-user app: no auth. Server functions use the publishable key against
// tables with RLS disabled (see the "remove auth" migration).
export function serverSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
