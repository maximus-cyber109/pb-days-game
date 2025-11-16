// Produces card and reward logic based on SKU/segment DB records or logic
function calculateRewardsForSKUs(skuObjs, tierProductsMap) {
  // For PB Cash: Only 1 SKU in order AND price < 1000
  if (skuObjs.length === 1 && skuObjs[0].product_price < 1000) {
    return { mode: "pb_cash", pb_cash: Math.round(skuObjs[0].product_price) * 0.01 };
  }
  // Determine card count for this order/user
  const userCards = Array.from(
    new Set(skuObjs.map(sku => sku.segment_code_to_card)) // build the card list
  );
  let cardCount = userCards.length;
  let tier = "";
  if (cardCount === 1) tier = '1';
  else if (cardCount >= 2 && cardCount <= 4) tier = '2-4';
  else if (cardCount >= 5 && cardCount <= 6) tier = '5-6';
  else if (cardCount === 7) tier = '7';

  return { mode: "cards", userCards, cardCount, tier };
}

// getSegmentCardMapping(): fetches from supabase `segment_cards`
async function getSegmentCardMapping() {
  if (!window.supabase) return {};
  const { data, error } = await supabase
    .from('segment_cards')
    .select('segment_code, card_name');
  if (error) { console.error('getSegmentCardMapping error:', error); return {}; }
  const map = {};
  data.forEach(row => map[row.segment_code] = row.card_name);
  return map;
}
