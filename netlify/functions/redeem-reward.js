const axios = require('axios'); // Still needed for the main handler, but not helper
const { createClient } = require('@supabase/supabase-js');

// --- Webengage Helper Function (MODIFIED) ---
async function sendWebengageEvent(eventName, data) {
  const licenseCode = process.env.WEBENGAGE_LICENSE_CODE;
  const apiKey = process.env.WEBENGAGE_API_KEY;

  if (!licenseCode || !apiKey) {
    console.warn('Webengage ENV not configured. Skipping event.');
    return;
  }
  
  const apiUrl = `https://api.webengage.com/v1/accounts/${licenseCode}/events`;
  console.log(`Attempting to send Webengage event [${eventName}] to URL: ${apiUrl}`);

  try {
    const payload = {
      userId: data.email, // Use email as the primary ID
      eventName: eventName,
      eventData: data
    };
    
    // ★★★ THIS IS THE FIX: Using fetch() like your working example ★★★
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (response.ok) {
        console.log(`Webengage event [${eventName}] sent for ${data.email}`);
    } else {
        console.error(`Webengage event [${eventName}] failed with status:`, response.status);
        const errorData = await response.json().catch(() => ({})); // Try to get error details
        console.error('Webengage error response data:', errorData);
    }
  
  } catch (error) {
    console.error(`Webengage event [${eventName}] failed:`, error.message);
  }
}
// --- End Webengage Helper ---

// --- Main Handler ---
// (This part is unchanged and correct)
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
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  try {
    let { data: product, error: fetchError } = await supabase
      .from('reward_products')
      .select('remainingqty, image_url, price')
      .eq('sku', reward.sku)
      .single();
    if (fetchError) throw new Error("Could not verify product.");
    if (product.remainingqty <= 0) {
      throw new Error("Reward is out of stock.");
    }
    let { error: logError } = await supabase
      .from('rewards_redeemed')
      .insert({
        customer_email: email,
        reward_sku: reward.sku,
        reward_name: reward.product_name,
        reward_tier: reward.tier
      });
    if (logError) {
        if (logError.code === '23505') {
            throw new Error("You have already claimed a reward.");
        }
        throw logError;
    }
    const newQty = product.remainingqty - 1;
    const { error: updateError } = await supabase
      .from('reward_products')
      .update({ remainingqty: newQty })
      .eq('sku', reward.sku);
    if (updateError) {
      console.error(`CRITICAL: Failed to update stock for ${reward.sku}`);
    }
    sendWebengageEvent('pb_reward_redeemed', { 
      email: email,
      reward_sku: reward.sku,
      reward_name: reward.product_name,
      reward_tier: reward.tier,
      reward_price: product.price || 0,
      reward_image_url: product.image_url || '',
      customer_name: customerName,
      cards_held_count: cardsHeldCount
    });
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
