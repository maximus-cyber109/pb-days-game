const axios = require('axios');

exports.handler = async (event, context) => {
  // Fire-and-forget headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const data = JSON.parse(event.body || '{}');
  const { email, type } = data;
  
  const licenseCode = process.env.WEBENGAGE_LICENSE_CODE;
  const apiKey = process.env.WEBENGAGE_API_KEY;
  if (!licenseCode || !apiKey) return { statusCode: 200, headers, body: 'Config missing' };

  const apiUrl = `https://api.webengage.com/v1/accounts/${licenseCode}/events`;
  
  let eventName = "";
  let eventData = {};

  if (type === 'reward') {
      eventName = 'pb_reward_redeemed';
      eventData = {
          reward_sku: data.reward.sku,
          reward_name: data.reward.product_name,
          reward_tier: data.reward.tier,
          reward_price: data.reward.price || 0,
          customer_name: data.customerName,
          cards_held_count: data.cardsHeldCount
      };
  } else if (type === 'cash') {
      eventName = 'pb_cash_redeemed';
      eventData = {
          amount: data.amount,
          order_id_used: data.orderIdUsed,
          customer_name: data.customerName
      };
  }

  const payload = {
      userId: email,
      eventName: eventName,
      eventData: eventData
  };

  try {
      console.log(`Sending ${eventName} for ${email}`);
      // Switch to AXIOS (Already installed)
      await axios.post(apiUrl, payload, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
      });
      return { statusCode: 200, headers, body: 'Event Sent' };
  } catch (e) {
      console.error("Webengage error:", e.message);
      return { statusCode: 500, headers, body: e.message };
  }
};
