const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// This function's *only* job is to look up DB data and send it to Webengage
exports.handler = async (event, context) => {
  const { email, type } = JSON.parse(event.body);

  if (!email || !type) {
    return { statusCode: 400, body: 'Missing email or type' };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  const licenseCode = process.env.WEBENGAGE_LICENSE_CODE;
  const apiKey = process.env.WEBENGAGE_API_KEY;

  if (!licenseCode || !apiKey) {
    console.error('Webengage ENV not configured.');
    return { statusCode: 500, body: 'Webengage ENV not configured' };
  }

  let eventName;
  let eventData = { email: email };

  try {
    // 1. Look up data that *already exists*
    if (type === 'reward') {
      eventName = 'pb_reward_redeemed';
      
      const { data: redeemData, error } = await supabase
        .from('rewards_redeemed')
        .select('reward_name, reward_sku, reward_tier')
        .eq('customer_email', email)
        .single();
      
      if (error) throw error;

      const { data: productData, error: pError } = await supabase
        .from('reward_products')
        .select('image_url, price')
        .eq('sku', redeemData.reward_sku)
        .single();

      if (pError) throw pError;
        
      eventData = {
        ...eventData,
        reward_name: redeemData.reward_name,
        reward_sku: redeemData.reward_sku,
        reward_tier: redeemData.reward_tier,
        reward_image_url: productData.image_url,
        reward_price: productData.price
      };

    } else if (type === 'cash') {
      eventName = 'pb_cash_redeemed';

      const { data: cashData, error } = await supabase
        .from('pb_cash')
        .select('amount, order_id_used')
        .eq('customer_email', email)
        .single();
      
      if (error) throw error;

      eventData = {
        ...eventData,
        amount: cashData.amount,
        order_id_used: cashData.order_id_used
      };
    
    } else {
      throw new Error('Invalid redemption type');
    }

    // 2. Send event to Webengage
    const apiUrl = `https://api.webengage.com/v1/accounts/${licenseCode}/events`;
    const payload = {
      userId: email,
      eventName: eventName,
      eventData: eventData
    };

    await axios.post(apiUrl, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log(`Webengage event [${eventName}] sent for ${email}`);
    return { statusCode: 202 }; // 202 Accepted (fire-and-forget)

  } catch (error) {
    console.error(`Webengage send-redeem-event failed for ${email}:`, error.message);
    return { statusCode: 500, body: error.message };
  }
};
