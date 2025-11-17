const axios = require('axios');

// --- NEW: Webengage Helper Function ---
// This function sends events from the backend
async function sendWebengageEvent(eventName, data) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { email, orderId } = JSON.parse(event.body || '{}');
    if (!email) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ success: false, error: 'Email required' }) 
      };
    }

    const API_TOKEN = process.env.MAGENTO_API_TOKEN;
    const BASE_URL = process.env.MAGENTO_BASE_URL.replace(/\/$/, '');

    if (!API_TOKEN || !BASE_URL) {
      throw new Error('Magento ENV not configured');
    }

    let searchUrl;
    
    if (orderId) {
      searchUrl = `${BASE_URL}/orders?` +
        `searchCriteria[filter_groups][0][filters][0][field]=increment_id&` +
        `searchCriteria[filter_groups][0][filters][0][value]=${encodeURIComponent(orderId)}&` +
        `searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;
    } else {
      searchUrl = `${BASE_URL}/orders?` +
        `searchCriteria[filter_groups][0][filters][0][field]=customer_email&` +
        `searchCriteria[filter_groups][0][filters][0][value]=${encodeURIComponent(email.toLowerCase())}&` +
        `searchCriteria[filter_groups][0][filters][0][condition_type]=eq&` +
        `searchCriteria[sort_orders][0][field]=created_at&` +
        `searchCriteria[sort_orders][0][direction]=DESC&` +
        `searchCriteria[page_size]=1`;
    }
    
    const response = await axios.get(searchUrl, {
      headers: { 
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 9000 // 9 second timeout
    });

    const ord = (response.data.items && response.data.items.length > 0) 
      ? response.data.items[0] 
      : null;
    
    if (!ord) {
      return { 
        statusCode: 404, 
        headers, 
        body: JSON.stringify({ success: false, error: 'Order not found' }) 
      };
    }

    const items = ord.items || [];
    const skus = items
      .map(item => item.sku)
      .filter(sku => sku);

    if (skus.length === 0) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ success: false, error: 'Order has no SKUs' }) 
      };
    }

    const customer_name = `${ord.customer_firstname || ''} ${ord.customer_lastname || ''}`.trim();

    const orderOut = {
      id: ord.entity_id,
      increment_id: ord.increment_id,
      grand_total: ord.grand_total,
      created_at: ord.created_at,
      customer_name: customer_name,
      items: items.map(i => ({ 
        sku: i.sku, 
        name: i.name || '', 
        qty: i.qty_ordered || 1, 
        price: i.price || 0 
      }))
    };

    return {
      statusCode: 200,
    await axios.post(apiUrl, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      // CHANGED: Increased timeout to 9 seconds
      timeout: 9000
    });
    console.log(`Webengage event [${eventName}] sent for ${data.email}`);
  } catch (error) {
    console.error('Error in magento-fetch:', error.message);
    let msg = error.response?.data?.message || error.message;
    return { 
      statusCode: error.response?.status || 500, 
      headers, 
      body: JSON.stringify({ success: false, error: msg }) 
    };
  }
}
// --- End Webengage Helper ---


exports.handler = async (event, context) => {
