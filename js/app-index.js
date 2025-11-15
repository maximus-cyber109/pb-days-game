const config = window.CR_CONFIG;
const CARD_IMAGES = config.cards;
const emailBox = document.getElementById('email-card-box');
const emailInput = document.getElementById('email-input');
const form = document.getElementById('email-form');
const deckElem = document.getElementById('cr-card-deck');
const loadingDiv = document.getElementById('loading-cards');
const sfxReveal = document.getElementById('reveal-sfx');
const sfxRare = document.getElementById('rare-sfx');
const bgMusic = document.getElementById('bg-music');
const logoImg = document.getElementById('logo-main');
let userEmail;

// Set logo/sounds from config
logoImg.src = config.logo;
bgMusic.src = config.sounds.bg;
sfxReveal.src = config.sounds.reveal;
sfxRare.src = config.sounds.rare;

// Modern browsers: require click/tap to start music!
function allowBGMusic() {
  if(bgMusic && bgMusic.paused){ try{ bgMusic.play(); }catch{} }
}
document.body.addEventListener('pointerdown', allowBGMusic, {once:true});

function finishEmail(email){
  userEmail = email.toLowerCase().trim();
  history.replaceState({}, '', "?email="+encodeURIComponent(userEmail));
  emailBox.style.display = 'none';
  startRevealFlow();
}
function emailCheck(){
  const urlParams = new URLSearchParams(window.location.search);
  let email = urlParams.get("email");
  if(!email){
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

async function startRevealFlow(){
  loadingDiv.style.display = "";
  deckElem.innerHTML = "";
  // --- 1. SUPABASE
  initSupabase();
  if (!window.supabase) {
    loadingDiv.innerHTML = "<span style='color:#95240e;'>Could not connect.<br/>Try in a moment.</span>";
    return;
  }
  // --- 2. Get order + SKUs
let order, skus;
try {
  let res = await fetch('/.netlify/functions/magento-fetch', {
    method: "POST",
    body: JSON.stringify({ email: userEmail }),
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  let data = await res.json();
  console.log("Magento response:", data);  // DEBUG LOG
  
  if(!data.success) {
    throw new Error(data.error || "No order returned from backend");
  }
  
  if(!data.order || !data.order.id) {
    throw new Error("Order object missing or invalid");
  }
  
  if(!Array.isArray(data.skus) || data.skus.length === 0) {
    throw new Error("No SKUs found in order");
  }
  
  order = data.order;
  skus = data.skus;
  
  console.log("Order ID:", order.id, "SKUs:", skus);  // DEBUG LOG
  
} catch (err) {
  console.error("Order fetch error:", err);
  loadingDiv.innerHTML = `<span style="color:#c82b11;">Error: ${err.message}</span>`;
  return;
}
  // --- 3. Lookup mapped cards for SKUs
  let { data: prodList=[] } = await supabase
    .from('products')
    .select('p_code, segment_code, product_price')
    .in('p_code', skus);
  if (!prodList.length) {
    loadingDiv.innerHTML = "No eligible cards.";
    return;
  }
  let segMap = await getSegmentCardMapping();
  let cards = prodList.map(p=>{
    let reward = calculateProductReward(p, segMap);
    if(reward.type==='card') return { card_name:reward.cardName, is_rare:reward.isRare, quantity:1 };
    return null;
  }).filter(Boolean);

  // --- 4. Tally for duplicates
  const cardTally = {};
  cards.forEach(c=>{
    if(!cardTally[c.card_name]) cardTally[c.card_name]={...c,quantity:0};
    cardTally[c.card_name].quantity+=1;
    cardTally[c.card_name].is_rare=cardTally[c.card_name].is_rare||c.is_rare;
  });

  // --- 5. Animate reveal, as per order
  loadingDiv.style.display = "none";
  deckElem.innerHTML = "";
  let arr = Object.values(cardTally), i=0;
  (function reveal(){
    if(i>=arr.length){
      document.getElementById('view-collection-btn').style.display="block";
      return;
    }
    let {card_name,is_rare,quantity} = arr[i];
    let div = document.createElement('div');
    div.className = "cr-card"+(is_rare?" rare":"");
    let img = document.createElement('img');
    img.className = "cr-image"; img.alt=card_name; img.src=CARD_IMAGES[card_name]||"";
    div.appendChild(img);
    let ttl = document.createElement('div');
    ttl.className = "cr-card-title"; ttl.textContent = card_name;
    div.appendChild(ttl);
    if(quantity>1) {
      let badge = document.createElement('span');
      badge.className = 'cr-card-count';
      badge.textContent = "x"+quantity; div.appendChild(badge);
    }
    let sfx = is_rare?sfxRare:sfxReveal;
    try{ sfx.currentTime=0; sfx.play(); }catch{}
    deckElem.appendChild(div);
    i++; setTimeout(reveal, 850);
  })();
  document.getElementById('view-collection-btn').onclick = ()=>window.location.href="redeem.html?email="+encodeURIComponent(userEmail);
}
if (userEmail) setTimeout(startRevealFlow, 90);
