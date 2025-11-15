// Reward logic for PB Days event

function calculateProductReward(product, segmentCardMap) {
  const price = parseFloat(product.product_price);
  const segmentCode = product.segment_code;
  const sku = product.p_code;
  if (price === 0) return { type: 'none' };
  if (price > 0 && price < 1000)
    return { type: 'value', amount: price * 0.01, sku: sku, price: price };
  if (price >= 1000) {
    let cardName, isRare = false;
    // Special CA (Tooth-Tyrant), IC (Device-Keeper), HD (LensWarden/Tooth-Tyrant by price), fallback = segmentCardMap
    if (segmentCode === 'CA') {
      cardName = 'Tooth-Tyrant'; // Always this card for CA
      isRare = false;
    } else if (segmentCode === 'HD') {
      cardName = price > 10000 ? 'Device-Keeper' : 'Tooth-Tyrant';
      isRare = price > 10000;
    } else if (segmentCode === 'IC') {
      cardName = segmentCardMap[segmentCode] || 'LensWarden';
      isRare = true;
    } else {
      cardName = segmentCardMap[segmentCode] || 'File-Forger';
      isRare = price > 10000;
    }
    return { type: 'card', cardName, segmentCode, isRare, sku, price };
  }
  return { type: 'none' };
}

function calculateOrderRewards(products, segmentCardMap) {
  const cards = [], valueRewards = [];
  products.forEach(product=> {
    const reward = calculateProductReward(product, segmentCardMap);
    if (reward.type === 'card') cards.push(reward);
    else if (reward.type === 'value') valueRewards.push(reward);
  });
  cards.sort((a,b)=>{
    if (a.isRare && !b.isRare) return -1;
    if (!a.isRare && b.isRare) return 1;
    return a.cardName.localeCompare(b.cardName);
  });
  return {
    cards,
    valueRewards,
    totalCards: cards.length,
    totalRareCards: cards.filter(c=>c.isRare).length,
    totalValueReward: valueRewards.reduce((sum,r)=>sum+r.amount,0)
  };
}

/**
 * Returns the segment-code to card-name mapping from Supabase
 * Assumes the global 'supabase' client is initialized!
 * Example: { "HD": "LensWarden",  "IC": "Device-Keeper", ...}
 */
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
