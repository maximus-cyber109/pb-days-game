// reward-logic.js — ALL real logic, no samples

// Helper: fetch live eligible rewards for a user's card tier
async function getLiveRewardsByTier(tier) {
  if (!window.supabaseClient) {
    console.error("Supabase client not initialized in getLiveRewardsByTier");
    return [];
  }
  let { data, error } = await window.supabaseClient
    .from('reward_products')
    .select('sku,product_name,image_url,remainingqty,tier,price') 
    .eq('tier', tier)
    .eq('is_active', true)
    .order('price', { ascending: false }); // Descending price sort
  if (error) { console.error("reward_products error: ", error); return []; }
  return data;
}

// **LOGIC CHANGE: >1000 Rs Threshold per Segment**
// Now accepts 'items' array: [{sku, qty, price}, ...]
async function getCardsFromOrderSkus(orderItems) {
  if (!window.supabaseClient) {
    console.error("Supabase client not initialized in getCardsFromOrderSkus");
    return [];
  }
  
  if (!orderItems || !orderItems.length) return [];

  // 1. Extract SKUs to query Supabase
  const skus = orderItems.map(i => i.sku);

  // 2. Get segment mapping for these SKUs
  let { data: prods, error: prodErr } = await window.supabaseClient
    .from('products_ordered')
    .select('p_code,segment_code') // We use price from Order, not DB
    .in('p_code', skus);
  
  if (prodErr || !prods) {
    console.error("Error fetching products_ordered", prodErr);
    return [];
  }

  // Create map: SKU -> Segment
  let skuToSeg = {};
  prods.forEach(p => skuToSeg[p.p_code] = p.segment_code);

  // 3. Calculate Total Spend per Segment
  // Logic: Sum (Price * Qty) for all items in the same segment
  let segmentTotals = {};

  orderItems.forEach(item => {
    const seg = skuToSeg[item.sku];
    if (seg) {
      if (!segmentTotals[seg]) segmentTotals[seg] = 0;
      segmentTotals[seg] += (item.price * item.qty);
    }
  });

  console.log("Segment Spend Totals:", segmentTotals);

  // 4. Filter Segments > 1000 Rs
  const qualifyingSegments = Object.keys(segmentTotals).filter(seg => segmentTotals[seg] > 1000);

  if (qualifyingSegments.length === 0) {
    console.log("No segments met the >1000 Rs threshold.");
    return [];
  }

  // 5. Get Card Names for Qualifying Segments
  let { data: segMappers, error: segErr } = await window.supabaseClient
    .from('segment_cards')
    .select('segment_code,card_name')
    .in('segment_code', qualifyingSegments);
  
  if (segErr) {
    console.error("Error fetching segment_cards", segErr);
    return [];
  }

  // 6. Return Unique Card Names
  let cardSet = new Set();
  segMappers.forEach(row => {
    if (row.card_name) cardSet.add(row.card_name);
  });
  
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
