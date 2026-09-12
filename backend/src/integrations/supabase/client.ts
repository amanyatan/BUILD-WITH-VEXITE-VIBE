import { createClient } from "@supabase/supabase-js";
import { config } from "../../config";

export const supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
