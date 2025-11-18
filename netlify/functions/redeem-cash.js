const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const { email, orderIdUsed, amount } = JSON.parse(event.body);
  if (!email || !amount) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing data' }) };
  
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    let { error } = await supabase.from('pb_cash').insert({ 
      customer_email: email, 
      order_id_used: orderIdUsed,
      amount: amount, 
      redeemed_at: new Date().toISOString() 
    });
    
    if (error) {
      if (error.code === '23505') throw new Error("You have already claimed a reward.");
      throw error;
    }
    
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) };
  }
};
