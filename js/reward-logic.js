// reward-logic.js — ALL real logic, no samples

// Helper: fetch live eligible rewards for a user's card tier
async function getLiveRewardsByTier(tier) {
  if (!window.supabaseClient) {
    console.error("Supabase client not initialized in getLiveRewardsByTier");
    return [];
  }
  let { data, error } = await window.supabaseClient
    .from('reward_products')
    .select('sku,product_name,image_url,remainingqty,tier,price') // ADDED: price
    .eq('tier', tier)
    .eq('is_active', true)
     // CHANGED: Sort by price descending
    .order('price', { ascending: false });
  if (error) { console.error("reward_products error: ", error); return []; }
  return data;
}

// **LOGIC CHANGE: Reverted to UNIQUE cards per order**
async function getCardsFromOrderSkus(p_codes) {
  if (!window.supabaseClient) {
    console.error("Supabase client not initialized in getCardsFromOrderSkus");
    return [];
  }
  
  // 1. Get products from the order
  let { data: prods, error: prodErr } = await window.supabaseClient
    .from('products_ordered')
    .select('p_code,segment_code,product_price')
    .in('p_code', p_codes);
  
  if (prodErr || !prods) {
    console.error("Error fetching products_ordered", prodErr);
    return [];
  }
  if (!prods.length) {
    console.log("No matching products found in products_ordered for SKUs:", p_codes);
    return [];
  }

  // 2. Get segment-to-card mapping
  let { data: segMappers, error: segErr } = await window.supabaseClient
    .from('segment_cards')
    .select('segment_code,card_name');
  
  if (segErr) {
    console.error("Error fetching segment_cards", segErr);
    return [];
  }

  let segMap = {};
  segMappers.forEach(row => segMap[row.segment_code] = row.card_name);
  
  // 3. Create a SET of UNIQUE cards (no duplicates per order)
  let cardSet = new Set();
  prods.forEach(p => {
    const card = segMap[p.segment_code];
    if (card) {
      cardSet.add(card);
    }
  });
  
  // Returns an array like: ['Crown-Shaper', 'File-Forger']
  return Array.from(cardSet);
}

// PB Cash calculation logic: Single eligible SKU orders only (<1000 Rs)
function calculatePbCash(skuObjList) {
  if (!skuObjList || skuObjList.length === 0) return 0;
  
  const eligibleProd = skuObjList.find(p => p.product_price < 1000);

  if (skuObjList.length === 1 && eligibleProd) {
    return Math.round(eligibleProd.product_price * 0.01);
  }
  return 0;
}

window.getLiveRewardsByTier = getLiveRewardsByTier;
window.getCardsFromOrderSkus = getCardsFromOrderSkus;
window.calculatePbCash = calculatePbCash;
