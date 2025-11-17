const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// This function's *only* job is to look up DB data and send it to Webengage
exports.handler = async (event, context) => {
  const { email, customerName } = JSON.parse(event.body);

  if (!email) {
    return { statusCode: 400, body: 'Missing email' };
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

  try {
    // 1. Look up data that *already exists*
    const { data: stats, error: statsError } = await supabase
      .from('customer_stats')
      .select('unique_cards')
      .eq('customer_email', email)
      .single();

    const { data: cards, error: cardsError } = await supabase
      .from('cards_earned')
      .select('card_name')
      .eq('customer_email', email);

    if (statsError || cardsError) {
      throw new Error(statsError?.message || cardsError?.message);
    }

    const uniqueCardNames = [...new Set(cards.map(c => c.card_name))];

    // 2. Prepare event payload
    const eventData = {
      email: email,
      customer_name: customerName,
      total_unique_cards: stats.unique_cards,
      all_cards_list: uniqueCardNames.join(', ')
    };

    // 3. Send event to Webengage
    const apiUrl = `https://api.webengage.com/v1/accounts/${licenseCode}/events`;
    const payload = {
      userId: email,
      eventName: 'pb_card_collection_status', // New, clearer event name
      eventData: eventData
    };

    await axios.post(apiUrl, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log(`Webengage event [pb_card_collection_status] sent for ${email}`);
    return { statusCode: 202 }; // 202 Accepted (fire-and-forget)

  } catch (error) {
    console.error(`Webengage send-card-event failed for ${email}:`, error.message);
    return { statusCode: 500, body: error.message };
  }
};
