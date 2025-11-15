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

// --- MAIN Reveal logic next ---
async function startRevealFlow() {
  // Show loading spinner
  loadingDiv.style.display = "";
  deckElem.innerHTML = "";

  // --- 1. SUPABASE ENV ---
  initSupabase();
  if (!window.supabase) {
    loadingDiv.innerHTML = "<span style='color:#fff;'>Could not connect to rewards server.<br/><small>Try again in a moment.</small></span>";
    return;
  }

  // --- 2. GET latest ORDER for email (call your serverless/netlify function, which must return order id) ---
  let order = null;
  try {
    let resp = await fetch('/.netlify/functions/magento-fetch', {
      method: "POST",
      body: JSON.stringify({ email: userEmail }),
      headers: { 'Content-Type': 'application/json' }
    }).then(r=>r.json());
    if(!resp.success || !resp.order || !resp.order.id) throw new Error("No eligible order found.");
    order = resp.order;
    document.getElementById("subtitle-order").innerHTML = `<br/><small style="font-family:'Rubik',Arial;color:#b3e3ff;font-size:.82em;">Order #${order.increment_id}</small>`;
  } catch(e){
    loadingDiv.innerHTML = `<span style="color:#fff;"><br>No eligible order found for this email!</span>`;
    return;
  }

  // --- 3. GET Cards earned for this order ---
  let { data: cards=[] } = await supabase
    .from('cards_earned')
    .select('card_name, is_rare, quantity')
    .eq("order_id", order.id);

  // --- 4. Render Animation (one by one, only what user earned!) ---
  if(!cards.length){
    loadingDiv.innerHTML = `<span style="color:#fbbf24;">No cards earned for this order.<br/>Try another!</span>`;
    return;
  }

  loadingDiv.style.display = "none";
  deckElem.innerHTML = "";
  let revealed = 0;
  (function revealCards() {
    if(revealed >= cards.length) {
      document.getElementById('view-collection-btn').style.display = "block";
      return;
    }
    let {card_name, is_rare, quantity} = cards[revealed];
    let cardDiv = document.createElement('div');
    cardDiv.className = "cr-card" + (is_rare?" rare":"");
    // Card image
    let img = document.createElement('img');
    img.className = "cr-image";
    img.alt = card_name;
    img.src = CARD_IMAGES[card_name] || "";
    cardDiv.appendChild(img);
    // Card name
    let title = document.createElement('div');
    title.className = "cr-card-title";
    title.textContent = card_name;
    cardDiv.appendChild(title);
    // Count badge
    if(quantity>1){
      let badge = document.createElement('span');
      badge.className = 'cr-card-count';
      badge.textContent = "x" + quantity;
      cardDiv.appendChild(badge);
    }
    // SFX
    let sfx = is_rare ? sfxRare : sfxReveal;
    try{ sfx.currentTime=0; sfx.play(); }catch{}
    deckElem.appendChild(cardDiv);
    revealed++;
    setTimeout(revealCards, 780);
  })();

  // Button: Go to collection
  document.getElementById('view-collection-btn').onclick = function(){
    window.location.href = "redeem.html?email=" + encodeURIComponent(userEmail);
  };
}
if (userEmail) setTimeout(startRevealFlow, 100);
