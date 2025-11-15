/**
 * Calculate reward for a single product
 * Input: { p_code, segment_code, product_price }
 */
function calculateProductReward(product, segmentCardMap) {
  const price = parseFloat(product.product_price);
  const segmentCode = product.segment_code;
  const sku = product.p_code;

  // Rule A: Zero value products → No reward
  if (price === 0) {
    return { type: 'none' };
  }

  // Rule B: Low value products (< 1000) → 1% cash reward
  if (price > 0 && price < 1000) {
    return {
      type: 'value',
      amount: price * 0.01,
      sku: sku,
      price: price
    };
  }

  // Rule C: High value products (>= 1000) → Cards
  if (price >= 1000) {
    let cardName;
    let isRare = false;

    // Special HD Segment Rules
    if (segmentCode === 'HD') {
      if (price > 10000) {
        cardName = 'Device-Keeper';  // Rare HD card
        isRare = true;
      } else {
        cardName = 'Tooth-Tyrant';   // CatchAll for HD 1k-10k
        isRare = false;
      }
    }
    // IC Segment (always rare)
    else if (segmentCode === 'IC') {
      cardName = segmentCardMap[segmentCode] || 'LensWarden';
      isRare = true;
    }
    // All other segments (RF, RS, IN, CA, DP)
    else {
      cardName = segmentCardMap[segmentCode] || 'Tooth-Tyrant';
      isRare = price > 10000;  // Rare if over 10k
    }

    return {
      type: 'card',
      cardName: cardName,
      segmentCode: segmentCode,
      isRare: isRare,
      sku: sku,
      price: price
    };
  }

  return { type: 'none' };
}

/**
 * Calculate all rewards for an order
 */
function calculateOrderRewards(products, segmentCardMap) {
  const cards = [];
  const valueRewards = [];

  products.forEach(product => {
    const reward = calculateProductReward(product, segmentCardMap);
    
    if (reward.type === 'card') {
      cards.push(reward);
    } else if (reward.type === 'value') {
      valueRewards.push(reward);
    }
  });

  // Sort cards: rare first, then alphabetically
  cards.sort((a, b) => {
    if (a.isRare && !b.isRare) return -1;
    if (!a.isRare && b.isRare) return 1;
    return a.cardName.localeCompare(b.cardName);
  });

  return {
    cards: cards,
    valueRewards: valueRewards,
    totalCards: cards.length,
    totalRareCards: cards.filter(c => c.isRare).length,
    totalValueReward: valueRewards.reduce((sum, r) => sum + r.amount, 0)
  };
}
