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
    
    // If orderId provided, fetch that specific order
    if (orderId) {
      console.log('Fetching specific order:', orderId);
      searchUrl = `${BASE_URL}/orders?` +
        `searchCriteria[filter_groups][0][filters][0][field]=increment_id&` +
        `searchCriteria[filter_groups][0][filters][0][value]=${encodeURIComponent(orderId)}&` +
        `searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;
    } else {
      // Otherwise fetch by email, sorted by created_at DESC (newest first)
      console.log('Fetching latest order for email:', email);
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

    console.log('Response items:', response.data.items?.length);

    const ord = (response.data.items && response.data.items.length > 0) 
      ? response.data.items[0] 
      : null;
    
    if (!ord) {
      console.warn('No order found');
      return { 
        statusCode: 404, 
        headers, 
        body: JSON.stringify({ success: false, error: 'Order not found' }) 
      };
    }

    console.log('✓ Order:', ord.entity_id, 'Increment:', ord.increment_id, 'Email:', ord.customer_email);
    console.log('✓ Items count:', ord.items?.length);
    console.log('✓ SKUs:', ord.items?.map(i => i.sku));

    const items = ord.items || [];
    const skus = items
      .map(item => item.sku)
      .filter(sku => sku);

    if (skus.length === 0) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ 
          success: false, 
          error: 'Order has no SKUs' 
        }) 
      };
    }

    const orderOut = {
      id: ord.entity_id,
      increment_id: ord.increment_id,
      grand_total: ord.grand_total,
      created_at: ord.created_at,
      items: items.map(i => ({ 
        sku: i.sku, 
        name: i.name || '', 
        qty: i.qty_ordered || 1, 
        price: i.price || 0 
      }))
    };

    console.log('✓ Returning order with', skus.length, 'SKUs:', skus);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        order: orderOut,
        skus: skus
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
