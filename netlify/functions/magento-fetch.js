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
    const { email } = JSON.parse(event.body || '{}');
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
      console.error('ENV missing:', { 
        hasToken: !!API_TOKEN, 
        hasUrl: !!BASE_URL 
      });
      throw new Error('Magento ENV not configured');
    }

    // CORRECT ENDPOINT: /orders (not /rest/V1/orders)
    const searchUrl = `${BASE_URL}/orders?` +
      `searchCriteria[filter_groups][0][filters][0][field]=customer_email&` +
      `searchCriteria[filter_groups][0][filters][0][value]=${encodeURIComponent(email.toLowerCase())}&` +
      `searchCriteria[filter_groups][0][filters][0][condition_type]=eq&` +
      `searchCriteria[sort_orders][0][field]=created_at&` +
      `searchCriteria[sort_orders][0][direction]=DESC&` +
      `searchCriteria[page_size]=1`;

    console.log('Fetching order for email:', email);
    console.log('Search URL:', searchUrl);
    
    const response = await axios.get(searchUrl, {
      headers: { 
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 12000
    });

    console.log('Response status:', response.status);
    console.log('Items found:', response.data.items?.length || 0);

    // Get first (latest) order
    const ord = (response.data.items && response.data.items.length > 0) 
      ? response.data.items[0] 
      : null;
    
    if (!ord) {
      console.warn('No orders found for email:', email);
      return { 
        statusCode: 404, 
        headers, 
        body: JSON.stringify({ 
          success: false, 
          error: 'No order found for this email' 
        }) 
      };
    }

    console.log('Order found - ID:', ord.entity_id, 'Increment:', ord.increment_id);
    console.log('Items in order:', ord.items?.length || 0);

    // Extract items safely
    const items = Array.isArray(ord.items) ? ord.items : [];
    
    if (items.length === 0) {
      console.warn('Order has no items!');
      return { 
        statusCode: 404, 
        headers, 
        body: JSON.stringify({ 
          success: false, 
          error: 'Order has no items to process' 
        }) 
      };
    }

    // Extract SKUs from items
    const skuList = items
      .map(i => {
        console.log('Item:', { sku: i.sku, name: i.name, qty: i.qty_ordered });
        return i.sku;
      })
      .filter(sku => sku && sku.trim() !== '');

    console.log('SKUs extracted:', skuList);

    if (skuList.length === 0) {
      console.warn('No valid SKUs in order items');
      return { 
        statusCode: 404, 
        headers, 
        body: JSON.stringify({ 
          success: false, 
          error: 'Order items missing SKUs' 
        }) 
      };
    }

    // Build order response
    const orderOut = {
      id: ord.entity_id,
      increment_id: ord.increment_id,
      grand_total: ord.grand_total,
      created_at: ord.created_at,
      customer_email: ord.customer_email,
      items: items.map(i => ({ 
        sku: i.sku, 
        name: i.name || 'Product',
        qty: i.qty_ordered || 1, 
        price: i.price || 0 
      }))
    };

    console.log('✓ Success - Returning order', orderOut.id, 'with', skuList.length, 'SKUs');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        order: orderOut,
        skus: skuList
      })
    };

  } catch (error) {
    console.error('Magento API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    let msg = error.response?.data?.message 
      || error.message 
      || 'Unknown error';
    
    return { 
      statusCode: error.response?.status || 500, 
      headers, 
      body: JSON.stringify({ 
        success: false, 
        error: msg 
      }) 
    };
  }
};
