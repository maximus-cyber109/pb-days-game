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

  console.log('[Magento Fetch] Function started');

  try {
    const { email, orderId } = JSON.parse(event.body || '{}');
    console.log(`[Magento Fetch] Received request for Email: ${email}, OrderID: ${orderId || 'Latest'}`);

    if (!email) {
      console.error('[Magento Fetch] Missing email in payload');
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ success: false, error: 'Email required' }) 
      };
    }

    const API_TOKEN = process.env.MAGENTO_API_TOKEN;
    const BASE_URL = process.env.MAGENTO_BASE_URL.replace(/\/$/, '');

    if (!API_TOKEN || !BASE_URL) {
      console.error('[Magento Fetch] ENV variables missing');
      throw new Error('Magento ENV not configured');
    }

    let searchUrl;
    
    if (orderId) {
      console.log('[Magento Fetch] Searching by Order ID');
      searchUrl = `${BASE_URL}/orders?` +
        `searchCriteria[filter_groups][0][filters][0][field]=increment_id&` +
        `searchCriteria[filter_groups][0][filters][0][value]=${encodeURIComponent(orderId)}&` +
        `searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;
    } else {
      console.log('[Magento Fetch] Searching by Customer Email (Latest Order)');
      searchUrl = `${BASE_URL}/orders?` +
        `searchCriteria[filter_groups][0][filters][0][field]=customer_email&` +
        `searchCriteria[filter_groups][0][filters][0][value]=${encodeURIComponent(email.toLowerCase())}&` +
        `searchCriteria[filter_groups][0][filters][0][condition_type]=eq&` +
        `searchCriteria[sort_orders][0][field]=created_at&` +
        `searchCriteria[sort_orders][0][direction]=DESC&` +
        `searchCriteria[page_size]=1`;
    }
    
    console.log(`[Magento Fetch] Fetching from: ${BASE_URL}/orders...`);

    const response = await axios.get(searchUrl, {
      headers: { 
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        
        // Custom Headers for Firewall Whitelisting
        'User-Agent': 'PB_Netlify', 
        'X-Source-App': 'Netlify',
        
        // ★★★ NEW SECRET HEADER ★★★
        'X-Netlify-Secret': 'X-PB-NetlifY2025-901AD7EE35110CCB445F3CA0EBEB1494'
      },
      timeout: 9000 
    });

    console.log(`[Magento Fetch] Response Status: ${response.status}`);

    const ord = (response.data.items && response.data.items.length > 0) 
      ? response.data.items[0] 
      : null;
    
    if (!ord) {
      console.warn(`[Magento Fetch] No order found for ${email} (OrderId: ${orderId})`);
      return { 
        statusCode: 404, 
        headers, 
        body: JSON.stringify({ success: false, error: 'Order not found. Please check the email or order ID.' }) 
      };
    }

    // VERIFICATION: Ensure the order belongs to the requested email
    if (ord.customer_email && ord.customer_email.toLowerCase() !== email.toLowerCase()) {
        console.error(`[Magento Fetch] Security Mismatch! Order ${ord.increment_id} belongs to ${ord.customer_email}, but requested by ${email}`);
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ success: false, error: 'Email does not match the order records.' })
        };
    }

    console.log(`[Magento Fetch] Order validated for ${ord.customer_email}. Increment ID: ${ord.increment_id}`);

    const items = ord.items || [];
    const skus = items.map(item => item.sku).filter(sku => sku);

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

    console.log(`[Magento Fetch] Returning success for ${email}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        order: orderOut,
        skus: skus,
        customer_name: customer_name
      })
    };

  } catch (error) {
    console.error('[Magento Fetch] Error:', error.message);
    if (error.response && error.response.status === 403) {
        console.error('[Magento Fetch] 403 Forbidden Data:', JSON.stringify(error.response.data));
    }
    if (error.response) {
        console.error(`[Magento Fetch] Upstream Status: ${error.response.status}`);
    }
    
    let msg = error.response?.data?.message || error.message;
    return { 
      statusCode: error.response?.status || 500, 
      headers, 
      body: JSON.stringify({ success: false, error: msg }) 
    };
  }
};
