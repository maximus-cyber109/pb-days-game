const axios = require('axios');

exports.handler = async (event, context) => {
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
      timeout: 12000
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

    // ADDED: Customer Name
    const customer_name = `${ord.customer_firstname || ''} ${ord.customer_lastname || ''}`.trim();

    const orderOut = {
      id: ord.entity_id,
      increment_id: ord.increment_id,
      grand_total: ord.grand_total,
      created_at: ord.created_at,
      customer_name: customer_name, // ADDED
      items: items.map(i => ({ 
        sku: i.sku, 
        name: i.name || '', 
        qty: i.qty_ordered || 1, 
        price: i.price || 0 
      }))
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        order: orderOut,
        skus: skus,
        customer_name: customer_name // ADDED
      })
    };

  } catch (error) {
    console.error('Error:', error.message);
    let msg = error.response?.data?.message || error.message;
    
    return { 
      statusCode: error.response?.status || 500, 
      headers, 
      body: JSON.stringify({ success: false, error: msg }) 
    };
  }
};
