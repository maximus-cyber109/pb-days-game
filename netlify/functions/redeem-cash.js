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
  const { email, customerName, orderIdUsed, amount } = JSON.parse(event.body);
  if (!email || !orderIdUsed || !amount) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing email, order, or amount' }) };
  }
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  try {
    let { error } = await supabase.from('pb_cash').insert({ 
      customer_email: email, 
      order_id_used: orderIdUsed,
      amount: amount, 
      redeemed_at: new Date().toISOString() 
    });
    if (error) {
      if (error.code === '23505') {
          throw new Error("You have already claimed a reward.");
      }
      throw error;
    }
    sendWebengageEvent('pb_cash_redeemed', { 
      email: email,
      amount: amount,
      order_id_used: orderIdUsed,
      customer_name: customerName
    });
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
