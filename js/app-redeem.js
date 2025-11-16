const config = window.CR_CONFIG;
const LOGO_URL = config.logo;
const CARD_IMAGES = config.cards;
const ALL_CARDS = Object.keys(CARD_IMAGES);

let userEmail = new URLSearchParams(location.search).get('email');
let userIsOverride = false;
let overrideCards = [];

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
userIsOverride = !!overrideInfo;
let userCards = [];
let mainTier = "1";

function renderRockSlider(count) {
  let out = "";
  for (let i = 0; i < 7; ++i)
    out += `<span class="coc-progress-rock${i<count?" earned":""}"></span>`;
  document.getElementById('slider-rocks').innerHTML = out;
  document.getElementById('coc-progress-inner').style.width = `${(count/7)*100}%`;
  document.getElementById('slider-text').innerText = `${count}/7`;
}

// --- MAIN ---
(async function mainRedeem() {
  if (userIsOverride) {
    userCards = ALL_CARDS.slice(0, overrideInfo.cardCount);
  } else {
    let { data: earned = [] } = await supabase.from('cards_earned').select('card_name').eq('customer_email', userEmail);
    userCards = earned.map(c=>c.card_name);
  }
  mainTier =  (userCards.length === 1) ? '1'
          : (userCards.length >= 2 && userCards.length <= 4) ? '2-4'
          : (userCards.length >= 5 && userCards.length <= 6) ? '5-6'
          : (userCards.length === 7) ? '7' : '1';

  renderRockSlider(userCards.length);

  // --- Card grid
  const colDeck = document.getElementById('col-deck');
  colDeck.innerHTML = "";
  for (let i = 0; i < 4; ++i) {
    const cid = userCards[i] || ALL_CARDS[i] || '';
    let img = document.createElement('img');
    img.className = "reveal-card-static";
    img.src = CARD_IMAGES[cid] || config.fallbackCardImg || "";
    if (userCards.includes(cid)) img.classList.add('revealed');
    else img.classList.add('locked');
    colDeck.appendChild(img);
  }

  // --- Card gallery modal
  let galleryIdx = 0;
  function updateGallery(idx) {
    let card = ALL_CARDS[idx];
    const img = document.getElementById('gallery-card-img');
    img.src = CARD_IMAGES[card];
    img.className = "gallery-card-img " + (userCards.includes(card) ? "revealed" : "locked");
    document.getElementById('gallery-card-name').innerText = card.replace(/-/g, " ");
  }
  document.getElementById('open-gallery').onclick = function() {
    galleryIdx = userCards.length ? ALL_CARDS.indexOf(userCards[0]) : 0;
    updateGallery(galleryIdx);
    document.getElementById('gallery-modal').style.display = "flex";
  }
  document.getElementById('gallery-left').onclick = function () {
    galleryIdx = (galleryIdx+ALL_CARDS.length-1) % ALL_CARDS.length;
    updateGallery(galleryIdx);
  }
  document.getElementById('gallery-right').onclick = function () {
    galleryIdx = (galleryIdx+1) % ALL_CARDS.length;
    updateGallery(galleryIdx);
  }
  document.getElementById('gallery-close').onclick = function () {
    document.getElementById('gallery-modal').style.display = "none";
  }

  // --- PB Cash modal
  let pbCashAmount = null;
  if ((userIsOverride && overrideInfo.tier==='1') || (!userIsOverride && userCards.length===1)) {
    pbCashAmount = 40; // use live calcs for real mode, e.g. query order/sku from products_ordered
    document.getElementById('show-pb-cash').style.display = "";
  }
  document.getElementById('show-pb-cash').onclick = function() {
    document.getElementById('pb-cash-text').innerText = `You earned PB CASH: ₹${pbCashAmount || '0'}`;
    document.getElementById('pb-cash-modal').style.display="flex";
  }
  document.getElementById('pb-cash-claim').onclick = async function() {
    // Write to pb_cash if not already claimed
    if (!userIsOverride && pbCashAmount) {
      let { data: exists = [] } = await supabase.from('pb_cash').select('id').eq('email', userEmail);
      if (!exists.length) {
        await supabase.from('pb_cash').insert({ email: userEmail, amount: pbCashAmount, reward_time: new Date().toISOString() });
      }
    }
    document.getElementById('pb-cash-modal').style.display="none";
  }
  document.getElementById('pb-cash-close').onclick = function() {
    document.getElementById('pb-cash-modal').style.display="none"
  }

  // --- Rewards grid
  // TODO: fetch live reward pool by tier! Use reward_products for grid (see previous answers for reward table).
  // The following is a placeholder for one product tile per reward. Replace with reward pool lookup!
  let rewardSection = document.getElementById('reward-section');
  rewardSection.innerHTML = "";
  let sampleRewards = [
    {name:"Reward A",img:config.productImg,tier:"2-4",stock:3},
    {name:"Reward B",img:config.productImg,tier:"2-4",stock:0},
    {name:"Reward C",img:config.productImg,tier:"5-6",stock:1}
  ];
  for (let r of sampleRewards.filter(x=>x.tier===mainTier)) {
    let c = document.createElement('div');
    c.className = "product-card glow";
    let img = document.createElement('img'); img.className = "product-img"; img.src = r.img; c.appendChild(img);
    let title = document.createElement('div'); title.className = "product-name"; title.textContent = r.name; c.appendChild(title);
    let redeemBtn = document.createElement('button');
    redeemBtn.className = "btn-aqua btn-aqua-large";
    redeemBtn.textContent = r.stock<=0?"Out of Stock":"Redeem";
    redeemBtn.disabled = r.stock<=0;
    redeemBtn.onclick = function() {
      redeemBtn.textContent = "Redeemed!"; redeemBtn.disabled = true;
      // Actual redeem logic: decrement reward_products, insert into rewards_redeemed, lock others if max redemptions.
      // playSfx(redeemSfx);
    };
    c.appendChild(redeemBtn);
    rewardSection.appendChild(c);
  }

  // --- Leaderboard
  let { data: leaders = [] } = await supabase.from('customer_stats')
    .select('customer_email,customer_name,unique_cards')
    .order('unique_cards',{ascending:false}).limit(10);
  let lbHtml = (leaders.map((l, i) => `
    <div style="display:flex;align-items:center;gap:.33em;margin-bottom:.8em;padding:.4em .6em;background:#26233d;border-radius:.91em;border:1px solid #a259ff22;">
      <span style="font-size:1.09em;color:${i==0?"#fedc07":"#7ee3ff"};font-family:Bungee Spice,sans-serif;font-weight:bold;min-width:20px;">${i==0 ? "👑" : i+1}</span>
      <span style="flex:1;font-family:Bungee Spice,sans-serif;font-weight:600;color:#ecebfa;">${l.customer_name||l.customer_email}</span>
      <span style="background:#fedc07;color:#222;padding:.23em .5em;border-radius:.7em;font-size:.92em;font-weight:bold;">${l.unique_cards||0}</span>
    </div>
  `).join(""));
  document.getElementById("leaderboard").innerHTML = lbHtml;
})();
