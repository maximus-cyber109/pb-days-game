// Clash Royale UI — Supabase client using Netlify ENV pattern

let supabase = null;

function initSupabase() {
  // Netlify must inject window.ENV. 
  // (If not, add <script>window.ENV = {SUPABASE_URL: "...",SUPABASE_KEY: "..."};</script> to HTML!)
  if (!window.ENV || !window.ENV.SUPABASE_URL || !window.ENV.SUPABASE_KEY) {
    console.error('Supabase credentials not found in ENV');
    return;
  }
  supabase = window.supabase.createClient(
    window.ENV.SUPABASE_URL,
    window.ENV.SUPABASE_KEY
  );
  console.log('Supabase initialized');
}

// Example: customer cards
async function getCustomerCards(email) {
  if (!supabase) throw new Error("Supabase not initialized!");
  const { data, error } = await supabase
    .from('cards_earned')
    .select('*')
    .eq('customer_email', email)
    .order('earned_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Example: leaderboard
async function getLeaderboard(limit=10) {
  if (!supabase) throw new Error("Supabase not initialized!");
  const { data, error } = await supabase
    .from('customer_stats')
    .select('*')
    .order('unique_cards', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
