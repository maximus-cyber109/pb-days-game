// Initialize Supabase client
const supabase = window.supabase.createClient(
  CONFIG.supabaseUrl,
  CONFIG.supabaseKey
);

/**
 * Get segment to card mapping from database
 */
async function getSegmentCardMapping() {
  const { data, error } = await supabase
    .from('segment_cards')
    .select('segment_code, card_name');

  if (error) throw error;

  // Convert to map: { IC: 'LensWarden', HD: 'Device-Keeper', ... }
  const map = {};
  data.forEach(row => {
    map[row.segment_code] = row.card_name;
  });

  return map;
}

/**
 * Fetch products by SKUs
 */
async function getProductsBySKUs(skus) {
  const { data, error } = await supabase
    .from('products')
    .select('p_code, segment_code, product_price')
    .in('p_code', skus);

  if (error) throw error;
  return data || [];
}

/**
 * Save order and rewards to database
 */
async function saveOrderRewards(orderData, rewards) {
  try {
    // 1. Insert order
    const { error: orderError } = await supabase
      .from('orders')
      .insert({
        order_id: orderData.orderId,
        customer_email: orderData.email,
        grand_total: orderData.total,
        order_date: new Date().toISOString()
      });

    if (orderError) {
      // Check for duplicate (order already claimed)
      if (orderError.code === '23505') {
        return { success: false, error: 'Order already claimed!', duplicate: true };
      }
      throw orderError;
    }

    // 2. Insert cards
    if (rewards.cards.length > 0) {
      const cardsToInsert = rewards.cards.map(card => ({
        order_id: orderData.orderId,
        customer_email: orderData.email,
        card_name: card.cardName,
        segment_code: card.segmentCode,
        is_rare: card.isRare,
        product_sku: card.sku,
        product_price: card.price
      }));

      const { error: cardsError } = await supabase
        .from('cards_earned')
        .insert(cardsToInsert);

      if (cardsError) throw cardsError;
    }

    // 3. Insert value rewards
    if (rewards.valueRewards.length > 0) {
      const valueToInsert = rewards.valueRewards.map(reward => ({
        order_id: orderData.orderId,
        customer_email: orderData.email,
        product_sku: reward.sku,
        product_price: reward.price,
        reward_amount: reward.amount
      }));

      const { error: valueError } = await supabase
        .from('value_rewards')
        .insert(valueToInsert);

      if (valueError) throw valueError;
    }

    // 4. Update customer stats
    await updateCustomerStats(
      orderData.email,
      orderData.customerName || 'Customer',
      rewards
    );

    return { success: true };

  } catch (error) {
    console.error('Save rewards error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update customer stats for leaderboard
 */
async function updateCustomerStats(email, name, rewards) {
  const { data: existing } = await supabase
    .from('customer_stats')
    .select('*')
    .eq('customer_email', email)
    .single();

  if (existing) {
    // Update existing
    await supabase
      .from('customer_stats')
      .update({
        total_cards: existing.total_cards + rewards.totalCards,
        total_rare_cards: existing.total_rare_cards + rewards.totalRareCards,
        updated_at: new Date().toISOString()
      })
      .eq('customer_email', email);
  } else {
    // Insert new
    await supabase
      .from('customer_stats')
      .insert({
        customer_email: email,
        customer_name: name,
        total_cards: rewards.totalCards,
        total_rare_cards: rewards.totalRareCards
      });
  }
}

/**
 * Get customer's cards
 */
async function getCustomerCards(email) {
  const { data, error } = await supabase
    .from('cards_earned')
    .select('*')
    .eq('customer_email', email)
    .order('earned_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Check if order already claimed
 */
async function checkOrderClaimed(orderId) {
  const { data } = await supabase
    .from('orders')
    .select('order_id')
    .eq('order_id', orderId)
    .single();

  return data !== null;
}

/**
 * Get leaderboard
 */
async function getLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('customer_stats')
    .select('*')
    .order('total_cards', { ascending: false})
    .limit(limit);

  if (error) throw error;
  return data || [];
}
