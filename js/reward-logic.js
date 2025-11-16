// reward-logic.js (PB Days, prod-cards, PB Cash, glow)

function calculateProductReward(product, segmentCardMap) {
  const price = parseFloat(product.product_price);
  const segmentCode = product.segment_code;
  const sku = product.p_code;
  if (price === 0) return { type: 'none' };
  // PB CASH: Under 1000 = PB Cash, capped to 200
  if (price > 0 && price < 1000)
    return { type: 'pb_cash', amount: Math.min(price * 0.01, 200), sku: sku, price: price };
  // Reward product categories:
  if (price >= 1000) {
    let cardName, isRare = false;
    if (segmentCode === 'CA') {
      cardName = 'Tooth-Tyrant'; isRare = false;
    } else if (segmentCode === 'HD') {
      cardName = price > 10000 ? 'Device-Keeper' : 'Tooth-Tyrant';
      isRare = price > 10000;
    } else if (segmentCode === 'IC') {
      cardName = segmentCardMap[segmentCode] || 'LensWarden'; isRare = true;
    } else {
      cardName = segmentCardMap[segmentCode] || 'File-Forger';
      isRare = price > 10000;
    }
    // TIERED: use cardName as a "voucher" for tiers (2-4, 5-7, etc)
    let rewardTier;
    if (price >= 1000 && price < 3000) rewardTier = '2-4';
    else if (price >= 3000 && price < 15000) rewardTier = '5-7';
    else if (price >= 15000) rewardTier = '8-10';
    return { type: 'reward_product', cardName, rewardTier, isRare, sku, price };
  }
  return { type: 'none' };
}

function calculateOrderRewards(products, segmentCardMap) {
  const pbCash = [], productRewards = [];
  products.forEach(product => {
    const reward = calculateProductReward(product, segmentCardMap);
    if (reward.type === 'pb_cash') pbCash.push(reward);
    else if (reward.type === 'reward_product') productRewards.push(reward);
  });
  return {
    pbCash,
    productRewards,
    totalPB: pbCash.reduce((sum,r)=>sum+r.amount,0),
    productTiers: [...new Set(productRewards.map(p=>p.rewardTier))]
  };
}

// For segment mapping as before
async function getSegmentCardMapping() {
  if (!window.supabase) return {};
  const { data, error } = await supabase
    .from('segment_cards')
    .select('segment_code, card_name');
  if (error) {
    console.error('getSegmentCardMapping error:', error);
    return {};
  }
  const map = {};
  data.forEach(row => map[row.segment_code] = row.card_name);
  return map;
}
