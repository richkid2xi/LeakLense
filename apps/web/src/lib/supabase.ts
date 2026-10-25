import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://refawcgbpqfbeabvynzc.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlZmF3Y2dicHFmYmVhYnZ5bnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzIzMDMsImV4cCI6MjEwODQ0ODMwM30.ip-6fX52Hmzg3HSvCfWSkCwkyEw6W2UwZXa2lC4EQOA";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
