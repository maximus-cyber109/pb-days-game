const config = window.CR_CONFIG;
const LOGO_URL = config.logo;
const PRODUCT_TIERS = {
  '2-4': config.productTier_2_4,
  '5-6': config.productTier_5_6,
  '7': config.productTier_7
};
const PRODUCT_IMG_FALLBACK = "https://email-editor-resources.s3.amazonaws.com/images/82618240/NiTi-GLIDE-PATH-FILES-BOX-removebg-preview-UPDT.png";

const pbCashSfx = document.getElementById('pb-cash-sfx');
const redeemSfx = document.getElementById('redeem-sfx');
const bgMusic = document.getElementById('bg-music');

let userEmail = new URLSearchParams(location.search).get('email');
let isOverride = false;
let overrideInfo = null;

// ---- OVERRIDE LOGIC ----
function getOverrideTier(email) {
  let match = (email || '').match(/-ovrmaaz(\d(?:-\d)?)/);
  if (match) {
    const t = match[1];
    if (t === "1") return { tier: "1", cardCount: 1 };
    if (t === "2-4") return { tier: "2-4", cardCount: 3 };
    if (t === "5-6") return { tier: "5-6", cardCount: 6 };
    if (t === "7") return { tier: "7", cardCount: 7 };
  }
  return null;
}
overrideInfo = getOverrideTier(userEmail);
isOverride = !!overrideInfo;

// ---- PLAY SFX
function playSfx(sfx) { try { sfx.currentTime = 0; sfx.play(); } catch {} }
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

(async function mainRedeem() {
  // --- 1. Cards ---
  let userCards = [];
  if (isOverride) {
    // OVERRIDE: just simulate cards for this admin/test
    userCards = Object.keys(config.cards).slice(0, overrideInfo.cardCount || 1);
  } else {
    // REAL: fetch earned cards for this email
    let { data: earned = [] } = await supabase
      .from('cards_earned')
      .select('card_name')
      .eq('customer_email', userEmail);
    userCards = earned.map(c => c.card_name);
  }

  // --- 2. Show Cards Deck ---
  const ALL_CARDS = Object.keys(config.cards);
  const colDeck = document.getElementById('col-deck');
  colDeck.innerHTML = '';
  ALL_CARDS.forEach((card, i) => {
    let owned = userCards.includes(card);
    let div = document.createElement('div');
    div.className = "cr-card" + (owned ? " glow" : " locked");
    div.setAttribute("data-aos", "fade-zoom-in");
    div.setAttribute("data-aos-delay", `${i*70+210}`);
    let img = document.createElement('img');
    img.className = "cr-image";
    img.alt = card;
    img.src = config.cards[card] || PRODUCT_IMG_FALLBACK;
    div.appendChild(img);
    if (owned) {
      let badge = document.createElement('span');
      badge.className = "cr-card-count";
      badge.textContent = "✓";
      div.appendChild(badge);
    }
    colDeck.appendChild(div);
  });

  // --- 3. PB CASH LOGIC ---
  let pbCashBanner = document.querySelector('.pb-cash-banner');
  let pbCashAmount = null;
  if (isOverride && overrideInfo.tier === '1') {
    pbCashAmount = 40; // example fake value in override mode
  } else if (!isOverride && userCards.length === 1) {
    // Only 1 card: must check user's *last earned* order, get SKUs/prices from your real source...
    let { data: earned = [] } = await supabase.from('cards_earned').select('order_id,earned_at').eq('customer_email',userEmail).order('earned_at', {ascending:false}).limit(1);
    if (earned[0]) {
      // Demo: you would fetch order info via API or another table join
      // let's just say pbCashAmount = orderValue * 0.01
      pbCashAmount = Math.round(928 * 0.01); // REPLACE with your real logic
      // --- Only insert to pb_cash table if not already redeemed
      let { data: exists = [] } = await supabase.from('pb_cash').select('id').eq('email',userEmail);
      if (!exists.length) {
        await supabase.from('pb_cash').insert({ email: userEmail, amount: pbCashAmount, reward_time: new Date().toISOString() });
      }
    }
  }
  if (pbCashAmount) {
    pbCashBanner.innerHTML = `You earned PB CASH: <span class="pb-cash-highlight">&#8377;${pbCashAmount}</span>`;
    playSfx(pbCashSfx);
  } else if (userCards.length === 1) {
    pbCashBanner.innerHTML = `You earned PB CASH!`;
  } else {
    pbCashBanner.style.display = "none";
  }

  // --- 4. Product Grid For Tiers ---
  let rewardSection = document.getElementById('reward-section');
  rewardSection.innerHTML = '';
  let mainTier = (isOverride) ? overrideInfo.tier : (userCards.length === 1) ? '1'
          : (userCards.length >= 2 && userCards.length <= 4) ? '2-4'
          : (userCards.length >= 5 && userCards.length <= 6) ? '5-6'
          : (userCards.length === 7) ? '7' : '';
  let maxSelect = mainTier === '2-4' ? 1 : mainTier === '5-6' ? 2 : mainTier === '7' ? 1 : 0;
  let productsThisTier = (mainTier && PRODUCT_TIERS[mainTier]) ? PRODUCT_TIERS[mainTier] : [];

  // Show grid if >1 card and products available
  if (productsThisTier.length && mainTier !== '1') {
    let grid = document.createElement('div');
    grid.className = "product-grid";
    // SELECT count enforcement
    let redeemedCount = 0;
    for (let idx = 0; idx < productsThisTier.length; idx++) {
      let p = productsThisTier[idx];
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
      title.textContent = p.name;
      c.appendChild(title);

      // Check stock from DB for real user
      let isOut = false;
      if (!isOverride) {
        // Query product stock
        // let { data: prod = [] } = await supabase.from('products').select('remainingqty').eq('sku', p.sku);
        // isOut = !!(prod[0] && prod[0].remainingqty <= 0);
      }

      let redeemBtn = document.createElement('button');
      redeemBtn.className = "redeem-btn";
      redeemBtn.textContent = (isOut) ? "Out of Stock" : "Redeem";
      redeemBtn.disabled = isOut;
      redeemBtn.onclick = async function () {
        if (isOverride) {
          this.textContent = "Redeemed!";
          this.disabled = true;
          playSfx(redeemSfx);
        } else {
          // 1. Mark redemption in rewards_redeemed
          await supabase.from('rewards_redeemed')
            .insert({ email: userEmail, sku: p.sku, reward_time: new Date().toISOString(), tier: mainTier });
          // 2. Decrement stock for product in DB
          // await supabase.rpc('decrement_product_stock', { in_sku: p.sku }); // example if you have a function
          // 3. Lock product visually
          this.textContent = "Redeemed!";
          this.disabled = true;
          playSfx(redeemSfx);
        }
        redeemedCount++;
        // Enforce only maxSelect products per user
        if (redeemedCount >= maxSelect) {
          let allBtns = document.querySelectorAll('.redeem-btn:not([disabled])');
          allBtns.forEach(btn => btn.disabled = true);
        }
      };
      c.appendChild(redeemBtn);
      grid.appendChild(c);
    }
    rewardSection.appendChild(grid);

    let note = document.createElement('div');
    note.style = "text-align:center;margin-top:2em;color:#fff8;font-size:.98em;";
    note.textContent =
      mainTier === '2-4' ? "You can redeem 1 product for your tier. Unlock more cards for epic rewards."
      : mainTier === '5-6' ? "You can redeem 2 products for your tier. Unlock all 7 cards for exclusive rewards."
      : mainTier === '7' ? "You can redeem 1 premium product. You’ve reached the ultimate reward!"
      : "";
    rewardSection.appendChild(note);
  } else if (userCards.length === 1) {
    let mini = document.createElement('div');
    mini.style = "text-align:center;margin-top:2.1em;color:#fffa;font-size:1.19em;font-weight:600;";
    mini.textContent = "Unlock more cards for exciting products!";
    rewardSection.appendChild(mini);
  } else {
    let mini = document.createElement('div');
    mini.style = "text-align:center;margin-top:3em;color:#fffa;font-size:1.09em;";
    mini.textContent = "Unlock more cards to reveal exclusive rewards!";
    rewardSection.appendChild(mini);
  }

  // --- 5. Leaderboard (as before) ---
  let { data: leaders = [] } = await supabase.from('customer_stats')
    .select('customer_email,customer_name,unique_cards')
    .order('unique_cards',{ascending:false}).limit(10);

  let lbHtml = (leaders.map((l, i) => `
    <div style="display:flex;align-items:center;gap:.44em;margin-bottom:.8em;padding:.55em .66em;background:#1c1336b4;border-radius:.88em;border:1px solid #a259ff33;">
      <span style="font-size:1.26em;color:${i==0?"#ffef87":"#9f3ffe"};font-family:Inter,sans-serif;font-weight:bold;min-width:32px;">${i==0 ? "👑" : i+1}</span>
      <span style="flex:1;font-family:Inter,sans-serif;font-weight:600;color:#ecebfa;">${l.customer_name||l.customer_email}</span>
      <span style="background:#a259ff;color:#fff;padding:.31em .66em;border-radius:.7em;font-family:Inter,sans-serif;font-size:.95em;font-weight:bold;">${l.unique_cards||0}</span>
    </div>
  `).join("")) || "<span style='color:#888'>No leaderboard yet.</span>";
  document.getElementById("leaderboard").innerHTML = lbHtml;

  document.getElementById('back-btn').onclick = () =>
      location.href = "index.html?email=" + encodeURIComponent(userEmail);

})();
