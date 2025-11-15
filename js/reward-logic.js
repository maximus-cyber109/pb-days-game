function calculateProductReward(product, segmentCardMap) {
  const price = parseFloat(product.product_price);
  const segmentCode = product.segment_code;
  const sku = product.p_code;
  if (price === 0) return { type: 'none' };
  if (price > 0 && price < 1000)
    return { type: 'value', amount: price * 0.01, sku: sku, price: price };
  if (price >= 1000) {
    let cardName, isRare = false;
    if (segmentCode === 'HD') {
      cardName = price > 10000 ? 'Device-Keeper' : 'Tooth-Tyrant';
      isRare = price > 10000;
    } else if (segmentCode === 'IC') {
      cardName = segmentCardMap[segmentCode] || 'LensWarden';
      isRare = true;
    } else {
      cardName = segmentCardMap[segmentCode] || 'Tooth-Tyrant';
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
