const config = window.CR_CONFIG;
const CARD_IMAGES = config.cards;

// --- Email "faux modal" logic ---
const emailBox = document.getElementById('email-card-box');
const emailInput = document.getElementById('email-input');
const form = document.getElementById('email-form');
const deckElem = document.getElementById('cr-card-deck');
const logoImg = document.getElementById('logo-main');
const loadingDiv = document.getElementById('loading-cards');
const sfxReveal = document.getElementById('reveal-sfx');
const sfxRare = document.getElementById('rare-sfx');
const bgMusic = document.getElementById('bg-music');
let userEmail;

// Set logo and audio src from config
logoImg.src = config.logo;
bgMusic.src = config.sounds.bg; // You can change to your own SFX URL
sfxReveal.src = config.sounds.reveal;
sfxRare.src = config.sounds.rare;

// Mobile: don't auto-play audio! Only after user interaction
function enableBGMusic() {
  if(bgMusic && bgMusic.paused) { try { bgMusic.play(); } catch{} }
}
document.body.addEventListener('pointerdown', enableBGMusic, {once:true});

// Email logic
function finishEmail(email) {
  userEmail = email.toLowerCase().trim();
  history.replaceState({}, '', "?email=" + encodeURIComponent(userEmail));
  emailBox.style.display = 'none';
  startRevealFlow();
}

// Show email card if no query param
function emailCheck() {
  const urlParams = new URLSearchParams(window.location.search);
  let email = urlParams.get("email");
  if (!email) {
    emailBox.style.display = "flex";
    emailInput.value = "";
    emailInput.focus();
    form.onsubmit = function(e){
      e.preventDefault();
      finishEmail(emailInput.value);
    };
    return false;
  }
  userEmail = email.toLowerCase();
  emailBox.style.display = "none";
  return true;
}
emailCheck();

// ...[setup/ENV/email check]... (see previous responses)

async function startRevealFlow() {
  loadingDiv.style.display = "";
  deckElem.innerHTML = "";

  initSupabase();
  if (!window.supabase) {
    loadingDiv.innerHTML = "Could not connect to rewards server.";
    return;
  }

  // Get latest order + SKUs from the Netlify function
  let order, skus;
  try {
    let res = await fetch('/.netlify/functions/magento-fetch', {
      method: "POST",
      body: JSON.stringify({ email: userEmail }),
      headers: { 'Content-Type': 'application/json' }
    }).then(r=>r.json());
    if(!res.success || !res.order || !Array.isArray(res.skus) || !res.skus.length)
      throw new Error(res.error || "No order found.");
    order = res.order;
    skus = res.skus;
    document.getElementById("subtitle-order").innerHTML = `<br/><small style="font-family:'Rubik',Arial;color:#b3e3ff;font-size:.82em;">Order #${order.increment_id}</small>`;
  } catch (err){
    loadingDiv.innerHTML = "No eligible order found for this email!";
    return;
  }
  // Fetch card reward mapping for EACH SKU
  // e.g. from 'products' table in Supabase; you can also handle reward logic here if needed
  let { data: prodList=[] } = await supabase
    .from('products')
    .select('p_code, segment_code, product_price')
    .in('p_code', skus);
  if (!prodList.length) {
    loadingDiv.innerHTML = "No eligible products/cards.";
    return;
  }
  // Get segment-card mapping (one-time or cached)
  let segMap = await getSegmentCardMapping();
  // Use reward-logic.js for mapping (one card per SKU as per your rules)
  let cards = prodList.map(p => {
    let reward = calculateProductReward(p, segMap);
    if (reward.type === 'card') return { card_name: reward.cardName, is_rare: reward.isRare, quantity:1 };
    return null;
  }).filter(Boolean);

  // Tally (if multiple identical cards)
  const cardTally = {};
  cards.forEach(card=>{
    if(!cardTally[card.card_name]) cardTally[card.card_name]= {...card, quantity: 0};
    cardTally[card.card_name].quantity += 1;
    cardTally[card.card_name].is_rare = cardTally[card.card_name].is_rare || card.is_rare;
  });

  // Animate the user's actual results, one by one
  loadingDiv.style.display = "none";
  deckElem.innerHTML = "";
  let cardArr = Object.values(cardTally);
  let i = 0;
  (function revealNext(){
    if(i>=cardArr.length) {
      document.getElementById('view-collection-btn').style.display = "block";
      return;
    }
    let {card_name, is_rare, quantity} = cardArr[i];
    let div = document.createElement('div');
    div.className = "cr-card" + (is_rare ? " rare" : "");
    let img = document.createElement('img');
    img.className = "cr-image";
    img.src = CARD_IMAGES[card_name] || "";
    img.alt = card_name;
    div.appendChild(img);
    let title = document.createElement('div');
    title.className = "cr-card-title";
    title.textContent = card_name;
    div.appendChild(title);
    if (quantity > 1) {
      let badge = document.createElement('span');
      badge.className = 'cr-card-count';
      badge.textContent = "x" + quantity;
      div.appendChild(badge);
    }
    let sfx = is_rare ? sfxRare : sfxReveal;
    try{ sfx.currentTime=0; sfx.play(); }catch{}
    deckElem.appendChild(div);
    i++; setTimeout(revealNext, 800);
  })();

  document.getElementById('view-collection-btn').onclick = function() {
    window.location.href = "redeem.html?email=" + encodeURIComponent(userEmail);
  };
}
