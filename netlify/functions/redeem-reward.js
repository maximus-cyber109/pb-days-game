const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// --- Webengage Helper Function ---
async function sendWebengageEvent(eventName, data) {
  const licenseCode = process.env.WEBENGAGE_LICENSE_CODE;
  const apiKey = process.env.WEBENGAGE_API_KEY;

  if (!licenseCode || !apiKey) {
    console.warn('Webengage ENV not configured. Skipping event.');
    return;
  }
  const apiUrl = `https://api.webengage.com/v1/accounts/${licenseCode}/events`;
  try {
    const payload = {
      userId: data.email, // Use email as the primary ID
      eventName: eventName,
      eventData: data
    };
    await axios.post(apiUrl, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    console.log(`Webengage event [${eventName}] sent for ${data.email}`);
  } catch (error) {
    console.error(`Webengage event [${eventName}] failed:`, error.message);
  }
}
// --- End Webengage Helper ---

// --- Main Handler ---
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { email, customerName, cardsHeldCount, reward } = JSON.parse(event.body);

  if (!email || !reward) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing email or reward data' }) };
  }
  
  // Init Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY // <-- ★★★ THIS IS THE FIX ★★★
  );

  try {
    // 1. Check stock
    let { data: product, error: fetchError } = await supabase
      .from('reward_products')
      .select('remainingqty, image_url, price') // Get price/image for Webengage
      .eq('sku', reward.sku)
      .single();

    if (fetchError) throw new Error("Could not verify product.");
    if (product.remainingqty <= 0) {
      throw new Error("Reward is out of stock.");
    }

    // 2. Log the redemption (Uses UNIQUE customer_email constraint)
    let { error: logError } = await supabase
      .from('rewards_redeemed')
      .insert({
        customer_email: email,
        reward_sku: reward.sku,
        reward_name: reward.product_name,
        reward_tier: reward.tier
      });
      
    if (logError) {
        if (logError.code === '23505') { // Unique constraint violation
            throw new Error("You have already claimed a reward.");
        }
        throw logError;
    }
    
    // 3. Update stock
    const newQty = product.remainingqty - 1;
    const { error: updateError } = await supabase
      .from('reward_products')
      .update({ remainingqty: newQty })
      .eq('sku', reward.sku);
      
    if (updateError) {
      // This is bad, but the user *did* get the reward. Log it.
      console.error(`CRITICAL: Failed to update stock for ${reward.sku}`);
    }
      
    // 4. Send Webengage event
    await sendWebengageEvent('pb_reward_redeemed', {
      email: email,
      reward_sku: reward.sku,
      reward_name: reward.product_name,
      reward_tier: reward.tier,
      reward_price: product.price || 0,
      reward_image_url: product.image_url || '',
      customer_name: customerName,
      cards_held_count: cardsHeldCount
    });

    // 5. Success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Reward redeemed!' })
    };
    
  } catch (err) {
    console.error("Redemption failed:", err.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
