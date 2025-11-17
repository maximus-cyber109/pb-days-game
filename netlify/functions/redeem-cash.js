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
      timeout: 10000 // ★★★ THIS IS THE FIX (was 5000) ★★★
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

  const { email, customerName, orderIdUsed, amount } = JSON.parse(event.body);

  if (!email || !orderIdUsed || !amount) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing email, order, or amount' }) };
  }
  
  // Init Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY // Using Service Key for backend logic
  );

  try {
    // 1. Log the PB Cash claim (Uses UNIQUE customer_email constraint)
    let { error } = await supabase.from('pb_cash').insert({ 
      customer_email: email, 
      order_id_used: orderIdUsed,
      amount: amount, 
      redeemed_at: new Date().toISOString() 
    });
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
          throw new Error("You have already claimed a reward.");
      }
      throw error;
    }
    
    // 2. Send Webengage event (NO AWAIT)
    sendWebengageEvent('pb_cash_redeemed', { 
      email: email,
      amount: amount,
      order_id_used: orderIdUsed,
      customer_name: customerName
    });

    // 3. Success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'PB Cash redeemed!' })
    };

  } catch (err) {
    console.error("PB Cash claim error:", err.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
