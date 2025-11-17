// Clash Royale UI — Supabase client using Netlify ENV pattern

window.supabaseClient = null;

function initSupabase() {
  if (!window.APP_CONFIG || !window.APP_CONFIG.SUPABASE_URL || !window.APP_CONFIG.SUPABASE_KEY) {
    console.error('Supabase credentials not found in window.APP_CONFIG');
    return;
  }
  window.supabaseClient = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_KEY
  );
  console.log('Supabase initialized');
}

// Example: customer cards
async function getCustomerCards(email) {
  if (!window.supabaseClient) throw new Error("Supabase not initialized!");
  const { data, error } = await window.supabaseClient
    .from('cards_earned')
    .select('*')
    .eq('customer_email', email)
    .order('earned_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Example: leaderboard
async function getLeaderboard(limit=10) {
  if (!window.supabaseClient) throw new Error("Supabase not initialized!");
  const { data, error } = await window.supabaseClient
    .from('customer_stats')
    .select('*')
    .order('unique_cards', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
