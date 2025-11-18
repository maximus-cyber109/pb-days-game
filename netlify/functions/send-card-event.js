const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // 1. Fire-and-forget headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { email, customerName } = JSON.parse(event.body || '{}');

  if (!email) {
    return { statusCode: 400, headers, body: 'Missing email' };
  }

  // 2. Init Supabase (Service Key for secure access)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  const licenseCode = process.env.WEBENGAGE_LICENSE_CODE;
  const apiKey = process.env.WEBENGAGE_API_KEY;

  if (!licenseCode || !apiKey) {
    console.error('Webengage ENV not configured.');
    return { statusCode: 500, headers, body: 'Webengage ENV not configured' };
  }

  try {
    // 3. Fetch Card Data from DB
    // We fetch fresh data to ensure accuracy
    const { data: stats } = await supabase
      .from('customer_stats')
      .select('unique_cards')
      .eq('customer_email', email)
      .single();

    const { data: cards } = await supabase
      .from('cards_earned')
      .select('card_name')
      .eq('customer_email', email);

    const uniqueCardNames = [...new Set((cards || []).map(c => c.card_name))];

    // 4. Prepare Webengage Payload
    const eventData = {
      email: email,
      customer_name: customerName,
      total_unique_cards: stats ? stats.unique_cards : uniqueCardNames.length,
      all_cards_list: uniqueCardNames.join(', ')
    };

    const apiUrl = `https://api.webengage.com/v1/accounts/${licenseCode}/events`;
    const payload = {
      userId: email,
      eventName: 'pb_card_collection_status',
      eventData: eventData
    };

    console.log(`Sending pb_card_collection_status for ${email}`);

    // 5. Send to Webengage (Axios)
    await axios.post(apiUrl, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    return { statusCode: 200, headers, body: 'Event Sent' };

  } catch (error) {
    console.error(`Webengage error for ${email}:`, error.message);
    return { statusCode: 500, headers, body: error.message };
  }
};
