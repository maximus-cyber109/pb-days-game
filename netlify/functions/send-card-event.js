const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Card Image Mapping (Copied from config.js)
const CARD_IMAGES = {
  "LensWarden":  "https://email-editor-resources.s3.amazonaws.com/images/82618240/CARDS/LensWarden.png",
  "Device-Keeper": "https://email-editor-resources.s3.amazonaws.com/images/82618240/CARDS/Device-Keeper.png",
  "File-Forger": "https://email-editor-resources.s3.amazonaws.com/images/82618240/CARDS/File-Forger.png",
  "Crown-Shaper": "https://email-editor-resources.s3.amazonaws.com/images/82618240/CARDS/Crown-Shaper.png",
  "Blade-Bearer": "https://email-editor-resources.s3.amazonaws.com/images/82618240/CARDS/Blade-Bearer.png",
  "Tooth-Tyrant": "https://email-editor-resources.s3.amazonaws.com/images/82618240/CARDS/Tooth-Tyrant.png",
  "Quick-Cloth":  "https://email-editor-resources.s3.amazonaws.com/images/82618240/CARDS/Quick-Cloth.png"
};

exports.handler = async (event, context) => {
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
    // Fetch Card Data
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

    // Generate Image List
    const uniqueCardImages = uniqueCardNames.map(name => CARD_IMAGES[name] || '').filter(url => url);

    const eventData = {
      email: email,
      customer_name: customerName,
      total_unique_cards: stats ? stats.unique_cards : uniqueCardNames.length,
      all_cards_list: uniqueCardNames.join(', '),
      // ★★★ NEW: Comma-separated string of Image URLs ★★★
      all_cards_images_list: uniqueCardImages.join(', ') 
    };

    const apiUrl = `https://api.webengage.com/v1/accounts/${licenseCode}/events`;
    const payload = {
      userId: email,
      eventName: 'pb_card_collection_status',
      eventData: eventData
    };

    console.log(`Sending pb_card_collection_status for ${email}`);

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
