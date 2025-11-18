const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const { email, reward } = JSON.parse(event.body);
  if (!email || !reward) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing data' }) };
  }
  
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    // 1. Check stock
    let { data: product, error: fetchError } = await supabase
      .from('reward_products')
      .select('remainingqty')
      .eq('sku', reward.sku)
      .single();

    if (fetchError || !product) throw new Error("Product not found.");
    if (product.remainingqty <= 0) throw new Error("Reward is out of stock.");

    // 2. Log redemption
    let { error: logError } = await supabase
      .from('rewards_redeemed')
      .insert({
        customer_email: email,
        reward_sku: reward.sku,
        reward_name: reward.product_name,
        reward_tier: reward.tier
      });
      
    if (logError) {
        if (logError.code === '23505') throw new Error("You have already claimed a reward.");
        throw logError;
    }
    
    // 3. Update stock
    await supabase.from('reward_products')
      .update({ remainingqty: product.remainingqty - 1 })
      .eq('sku', reward.sku);
      
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    
  } catch (err) {
    console.error("Redemption error:", err.message);
    return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) };
  }
};
