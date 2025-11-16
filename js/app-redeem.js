const LOGO_URL = "https://email-editor-resources.s3.amazonaws.com/images/82618240/Logo.png";
const PRODUCT_IMG_URL = "https://email-editor-resources.s3.amazonaws.com/images/82618240/NiTi-GLIDE-PATH-FILES-BOX-removebg-preview-UPDT.png";
const PRODUCT_PLACEHOLDERS = [
  { name: "P1(2-4)", img: PRODUCT_IMG_URL },
  { name: "P2(2-4)", img: PRODUCT_IMG_URL },
  { name: "P3(2-4)", img: PRODUCT_IMG_URL },
  { name: "P4(2-4)", img: PRODUCT_IMG_URL },
  { name: "P5(2-4)", img: PRODUCT_IMG_URL },
  { name: "P6(2-4)", img: PRODUCT_IMG_URL },
  { name: "P7(2-4)", img: PRODUCT_IMG_URL },
  { name: "P8(2-4)", img: PRODUCT_IMG_URL },
  { name: "P9(2-4)", img: PRODUCT_IMG_URL },
  { name: "P10(2-4)", img: PRODUCT_IMG_URL }
];
const PRODUCT_PLACEHOLDERS_HIGH = [
  { name: "P1(5-7)", img: PRODUCT_IMG_URL },
  { name: "P2(5-7)", img: PRODUCT_IMG_URL },
  { name: "P3(5-7)", img: PRODUCT_IMG_URL },
  { name: "P4(5-7)", img: PRODUCT_IMG_URL },
  { name: "P5(5-7)", img: PRODUCT_IMG_URL },
  { name: "P6(5-7)", img: PRODUCT_IMG_URL },
  { name: "P7(5-7)", img: PRODUCT_IMG_URL },
  { name: "P8(5-7)", img: PRODUCT_IMG_URL },
  { name: "P9(5-7)", img: PRODUCT_IMG_URL },
  { name: "P10(5-7)", img: PRODUCT_IMG_URL }
];

const email = new URLSearchParams(location.search).get('email');
const pbCashSfx = document.getElementById('pb-cash-sfx');
const redeemSfx = document.getElementById('redeem-sfx');
const bgMusic = document.getElementById('bg-music');

let USER_CARDS = []; // Cards the user earned (string array)

function playSfx(sfx) {
  try { sfx.currentTime = 0; sfx.play(); } catch {}
}

function setBGMusic() {
  document.body.addEventListener('pointerdown', function bgTryOnce() {
    try { bgMusic.play(); } catch {}
    document.body.removeEventListener('pointerdown', bgTryOnce);
  }, { once: true });
  try { bgMusic.play(); } catch {}
}
setBGMusic();

initSupabase();
if (!window.supabase) {
  document.getElementById("col-deck").innerHTML = "<span style='color:#c82b11;'>Could not connect to Supabase.</span>";
  throw new Error("Supabase not initialized!");
}

// --- Main Runner ---
(async function () {
  // 1. Fetch all cards PB user has
  let { data: products = [] } = await supabase
    .from('products')
    .select('p_code, segment_code, product_price, product_name');
  
  let { data: allCards = [] } = await supabase
    .from('cards_earned')
    .select('card_name')
    .eq('customer_email', email);

  USER_CARDS = allCards.map(c => c.card_name);
  if (!USER_CARDS.length) USER_CARDS = [];

  // 2. Segment mapping
  let segMap = await getSegmentCardMapping();

  // 3. Calculate rewards
  // In reality, you should fetch the products this customer bought & match with above
  // Here: simulate PB_CASH for one product and tier for demo
  const pbCashAmount = 150; // Example, normally calculate from user's SKUs/purchases
  const productTiers = ['2-4']; // Example. Set to ['5-7'] for higher tier

  // --- PB CASH Banner ---
  document.querySelector('.pb-cash-banner').innerHTML = pbCashAmount
    ? `Congrats! You earned <span class="pb-cash-highlight">&#8377;${pbCashAmount} PB CASH</span> (max ₹200 per order).`
    : `No PB Cash earned for your order.`;

  if (pbCashAmount) {
    playSfx(pbCashSfx);
    // TODO: DB update for PB cash here
  }

  // --- Cards Section ---
  const cardDeck = document.getElementById('col-deck');
  cardDeck.innerHTML = '';
  // Assume 7 unique available cards possible for event
  const ALL_CARDS = [
    "LensWarden", "Device-Keeper", "File-Forger", "Crown-Shaper",
    "Tooth-Tyrant", "Tooth Bearer", "Quick Coth"
  ];
  ALL_CARDS.forEach((card, i) => {
    const owned = USER_CARDS.includes(card);
    const div = document.createElement('div');
    div.className = "cr-card" + (owned ? " glow" : " locked");
    div.setAttribute("data-aos", "fade-zoom-in");
    div.setAttribute("data-aos-delay", `${i * 90 + 200}`);
    const img = document.createElement('img');
    img.className = "cr-image";
    img.alt = card;
    img.src = window.CR_CONFIG.cards[card] || PRODUCT_IMG_URL;
    div.appendChild(img);
    if (owned) {
      let badge = document.createElement('span');
      badge.className = "cr-card-count";
      badge.textContent = "✓";
      div.appendChild(badge);
    }
    cardDeck.appendChild(div);
  });

  // --- Rewards/Product Redemption ---
  const rewardSection = document.getElementById('reward-section');
  rewardSection.innerHTML = '';

  // For 2–4 or 5–7, show grid of product rewards corresponding to tier
  let rewardProducts = [];
  let maxSelect = 1;

  if (productTiers.includes('2-4')) {
    rewardProducts = PRODUCT_PLACEHOLDERS;
    maxSelect = 1;
  } else if (productTiers.includes('5-7')) {
    rewardProducts = PRODUCT_PLACEHOLDERS_HIGH;
    maxSelect = 10;
  } else {
    rewardSection.innerHTML = `<div style="margin:3em 0 2em 0;text-align:center;color:#bbb;">Redeem more product cards to unlock brand rewards!</div>`;
  }

  if (rewardProducts.length) {
    let grid = document.createElement('div');
    grid.className = "product-grid";
    // Keep track of redemption count
    let redeemedCount = 0;
    rewardProducts.forEach((p, idx) => {
      let c = document.createElement('div');
      c.className = "product-card glow";
      c.setAttribute("data-aos", "fade-zoom-in");
      c.setAttribute("data-aos-delay", `${idx * 80 + 420}`);
      let img = document.createElement('img');
      img.className = "product-img";
      img.alt = p.name;
      img.src = p.img;
      c.appendChild(img);

      let title = document.createElement('div');
      title.className = 'product-name';
      title.textContent = "SpeedEndo"; // For now, placeholder. Replace with p.name for dynamic later
      c.appendChild(title);

      let redeemBtn = document.createElement('button');
      redeemBtn.className = "redeem-btn";
      redeemBtn.textContent = "Redeem";
      redeemBtn.onclick = function () {
        redeemedCount++;
        this.textContent = "Redeemed!";
        this.disabled = true;
        playSfx(redeemSfx);
        // TODO: call DB mutation here to mark reward as redeemed for the user, record product/key in DB
        // Example:
        // supabase.from('rewards_redeemed').insert({email, reward:p.name, time: new Date().toISOString()})
        if (redeemedCount >= maxSelect) {
          let allBtns = document.querySelectorAll('.redeem-btn:not([disabled])');
          allBtns.forEach(btn => btn.disabled = true);
        }
      };
      c.appendChild(redeemBtn);
      grid.appendChild(c);
    });
    rewardSection.appendChild(grid);
    let note = document.createElement('div');
    note.style = "text-align:center;margin-top:2em;color:#fff8;font-size:.98em;";
    note.textContent = `You can redeem up to ${maxSelect} product${maxSelect > 1 ? 's' : ''} for your card tier.`;
    rewardSection.appendChild(note);
  }

  // --- Leaderboard ---
  let { data: leaders = [] } = await supabase
    .from('customer_stats')
    .select('customer_email,customer_name,unique_cards')
    .order('unique_cards', { ascending: false }).limit(10);

  let lbHtml = (leaders.map((l, i) => `
    <div style="display:flex;align-items:center;gap:.44em;margin-bottom:.8em;padding:.55em .66em;background:#1c1336b4;border-radius:.88em;border:1px solid #a259ff33;">
      <span style="font-size:1.26em;color:${i==0?"#ffef87":"#9f3ffe"};font-family:Inter,sans-serif;font-weight:bold;min-width:32px;">${i==0 ? "👑" : i + 1}</span>
      <span style="flex:1;font-family:Inter,sans-serif;font-weight:600;color:#ecebfa;">${l.customer_name || l.customer_email}</span>
      <span style="background:#a259ff;color:#fff;padding:.31em .66em;border-radius:.7em;font-family:Inter,sans-serif;font-size:.95em;font-weight:bold;">${l.unique_cards || 0}</span>
    </div>
  `).join("")) || "<span style='color:#888'>No leaderboard yet.</span>";
  document.getElementById("leaderboard").innerHTML = lbHtml;

  // --- Back button
  document.getElementById('back-btn').onclick = () => location.href = "index.html?email=" + encodeURIComponent(email);
})();
