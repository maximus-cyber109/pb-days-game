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

    const normalizedEmail = email.toLowerCase().trim();
    const API_TOKEN = process.env.MAGENTO_API_TOKEN;
    const BASE_URL = process.env.MAGENTO_BASE_URL;

    if (!API_TOKEN || !BASE_URL) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Configuration error' })
      };
    }

    console.log('Fetching order for:', normalizedEmail);

    // Fetch latest order from Magento
    const searchUrl = `${BASE_URL}/orders?` +
      `searchCriteria[filterGroups][0][filters][0][field]=customer_email&` +
      `searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(normalizedEmail)}&` +
      `searchCriteria[filterGroups][0][filters][0][conditionType]=eq&` +
      `searchCriteria[sortOrders][0][field]=created_at&` +
      `searchCriteria[sortOrders][0][direction]=DESC&` +
      `searchCriteria[pageSize]=1`;

    const response = await axios.get(searchUrl, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    if (response.data.items && response.data.items.length > 0) {
      const order = response.data.items[0];
      
      console.log('Order found:', order.entity_id);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          customer: {
            id: order.customer_id,
            firstname: order.customer_firstname,
            lastname: order.customer_lastname,
            email: order.customer_email
          },
          order: {
            id: order.entity_id,
            increment_id: order.increment_id,
            grand_total: order.grand_total,
            created_at: order.created_at,
            items: order.items.map(item => ({
              sku: item.sku,
              name: item.name,
              qty: item.qty_ordered,
              price: item.price
            }))
          }
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ success: false, error: 'No order found for this email' })
    };

  } catch (error) {
    console.error('Magento fetch error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      })
    };
  }
};
