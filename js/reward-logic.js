// reward-logic.js — ALL real logic, no samples

// Helper: fetch live eligible rewards for a user's card tier
async function getLiveRewardsByTier(tier) {
  if (!window.supabase) return [];
  let { data, error } = await supabase
    .from('reward_products')
    .select('sku,product_name,image_url,remainingqty,tier')
    .eq('tier', tier)
    .eq('is_active', true)
    .order('product_name');
  if (error) { console.error("reward_products error: ", error); return []; }
  return data;
}

// Given a customer's SKUs, assign cards via segment_code mapping
async function getCardsFromOrderSkus(p_codes) {
  if (!window.supabase) return [];
  let { data: prods, error: prodErr } = await supabase
    .from('products_ordered')
    .select('p_code,segment_code,product_price')
    .in('p_code', p_codes);
  if (prodErr || !prods.length) return [];
  let { data: segMappers, error: segErr } = await supabase
    .from('segment_cards')
    .select('segment_code,card_name');
  let segMap = {};
  segMappers.forEach(row => segMap[row.segment_code] = row.card_name);
  // Assign 1 card per unique segment_code in this order
  let cardSet = new Set();
  prods.forEach(p => {
    const card = segMap[p.segment_code];
    if (card) cardSet.add(card);
  });
  return Array.from(cardSet);
}

// PB Cash calculation logic: Single eligible SKU orders only (<1000 Rs)
function calculatePbCash(skuObjList) {
  if (skuObjList.length === 1 && skuObjList[0].product_price < 1000) {
    return Math.round(skuObjList[0].product_price * 0.01); // always round
  }
  return 0;
}

window.getLiveRewardsByTier = getLiveRewardsByTier;
window.getCardsFromOrderSkus = getCardsFromOrderSkus;
window.calculatePbCash = calculatePbCash;
