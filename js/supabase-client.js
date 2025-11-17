// Clash Royale UI — Supabase client using Netlify ENV pattern

// FIX: Create the client on the window object to make it global
window.supabaseClient = null;

function initSupabase() {
  // Read from the new global config block
  if (!window.APP_CONFIG || !window.APP_CONFIG.SUPABASE_URL || !window.APP_CONFIG.SUPABASE_KEY) {
    console.error('Supabase credentials not found in window.APP_CONFIG');
    return;
  }
  // FIX: Assign the client to the global variable
  window.supabaseClient = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_KEY
  );
  console.log('Supabase initialized');
}

// Example: customer cards
async function getCustomerCards(email) {
  // FIX: Use the global client
  if (!window.supabaseClient) throw new Error("Supabase not initialized!");
  const { data, error } = await window.supabaseClient
    .from('cards_earned')
