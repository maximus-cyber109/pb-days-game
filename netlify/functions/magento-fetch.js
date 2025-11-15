const axios = require("axios");

exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };
  if (event.httpMethod === "OPTIONS") { return { statusCode: 200, headers, body: "" }; }
  try {
    const { email } = JSON.parse(event.body || "{}");
    if (!email) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: "Email required" }) };

    // -- 1. Query Magento API (replace YOUR_TOKEN and YOUR_BASE_URL) --
    const token = process.env.MAGENTO_API_TOKEN;
    const magentoBase = process.env.MAGENTO_BASE_URL;
    const magentoUrl = `${magentoBase}/orders?searchCriteria[filterGroups][0][filters][0][field]=customer_email&searchCriteria[filterGroups][0][filters][0][value]=${email}&searchCriteria[filterGroups][0][filters][0][conditionType]=eq&searchCriteria[sortOrders][0][field]=created_at&searchCriteria[sortOrders][0][direction]=DESC&searchCriteria[pageSize]=1`;

    const { data } = await axios.get(magentoUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!data.items || !data.items.length) throw new Error('Order not found.');
    const order = data.items[0];

    // Only extract relevant info
    const items = order.items.map(i=>({
      sku: i.sku,
      qty: i.qty_ordered
    }));
    const resp = {
      order: {
        id: order.entity_id,
        increment_id: order.increment_id,
        items
      }
    };
    return { statusCode: 200, headers, body: JSON.stringify({ success:true, ...resp }) };
  } catch(e){
    return { statusCode: 500, headers, body: JSON.stringify({ success:false, error: String(e.message) }) };
  }
};
