const config = window.CR_CONFIG;
const CARD_IMAGES = config.cards;
const LOGO_URL = config.logo;
const viewBtn = document.getElementById('view-collection-btn');
const sfxReveal = document.getElementById('reveal-sfx');
const sfxRare = document.getElementById('rare-sfx');
const bgMusic = document.getElementById('bg-music');
bgMusic.src = config.sounds.bg;
sfxReveal.src = config.sounds.reveal;
sfxRare.src = config.sounds.reveal;

let userEmail;
let userIsOverride = false;
let overrideCards = [];

function getOverrideTier(email) {
  if (!email) return null;
  let match = email.match(/-ovrmaaz(\d(?:-\d)?)/);
  if (match) {
    const t = match[1];
    if (t === "1") return { tier: "1", numCards: 1 };
    if (t === "2-4") return { tier: "2-4", numCards: 3 };
    if (t === "5-6") return { tier: "5-6", numCards: 6 };
    if (t === "7") return { tier: "7", numCards: 7 };
  }
  return null;
}

// --- SPLINE/3D SOUND INTERACTION ---
let interacted = false;
document.body.addEventListener('pointerdown', () => {
  interacted = true;
  try { bgMusic.play(); } catch {}
}, {once:true});

// --- UI + Email Modal ---
const emailBox = document.getElementById('email-card-box');
const emailInput = document.getElementById('email-input');
const form = document.getElementById('email-form');
function askEmail() {
  emailBox.style.display = "flex";
  emailInput.value = "";
  emailInput.focus();
  form.onsubmit = function(e){
    e.preventDefault();
    finishEmail(emailInput.value.trim());
  };
}
function finishEmail(val){
  userEmail = val.toLowerCase().trim();
  history.replaceState({}, '', "?email=" + encodeURIComponent(userEmail));
  emailBox.style.display = "none";
  startRevealFlow();
}

// --- Entry ---
function emailCheck() {
  const urlParams = new URLSearchParams(window.location.search);
  let email = urlParams.get("email");
  if (!email) {
    askEmail();
    return false;
  }
  userEmail = email.toLowerCase();
  emailBox.style.display = "none";
  return true;
}
emailCheck();

// --- Main Reveal Flow ---
async function startRevealFlow() {
  document.getElementById('loading-cards').style.display = "";
  document.getElementById('cr-card-deck').innerHTML = "";
  viewBtn.style.display = "none";

  initSupabase();

  // --- OVERRIDE/PREVIEW SUPPORT ---
  let overrideInfo = getOverrideTier(userEmail);
  userIsOverride = !!overrideInfo;
  let cardNames = Object.keys(config.cards);

  let revealCards = [];
  if (userIsOverride && overrideInfo) {
    // Fake override: just pick N unique cards
    overrideCards = cardNames.slice(0, overrideInfo.numCards);
    revealCards = overrideCards;
    // Skip DB writes in override mode
  } else {
    // Real user logic:
    // 1. Fetch this user's last order, SKUs, and get card reward mapping for segments
    let res = await fetch('/.netlify/functions/magento-fetch', {
      method: "POST",
      body: JSON.stringify({ email: userEmail }),
      headers: { 'Content-Type': 'application/json' }
    });
    let data = await res.json();
    if (!data.success) {
      document.getElementById('loading-cards').innerHTML = `<span style="color:#c82b11;">Error: ${data.error}</span>`;
      return;
    }
    let order = data.order;
    let skus = data.skus;
    let { data: prodList = [] } = await supabase
      .from('products')
      .select('p_code, segment_code, product_price')
      .in('p_code', skus);

    let segMap = await getSegmentCardMapping();
    let uniqueCards = {};
    prodList.forEach(p => {
      const segmentName = segMap[p.segment_code] || cardNames.find(c => c.toLowerCase().includes(p.segment_code.toLowerCase()));
      if (segmentName) uniqueCards[segmentName] = true;
    });
    revealCards = Object.keys(uniqueCards);

    // After reveal, store DB (only if not already there)
    for(const card of revealCards){
      let { data: existing } = await supabase.from('cards_earned')
        .select('id').eq('customer_email', userEmail).eq('card_name', card);
      if(!existing.length){
        await supabase.from('cards_earned').insert({
          customer_email: userEmail,
          card_name: card,
          earned_at: new Date().toISOString()
        });
      }
    }
  }

  // --- Reveal Animation ---
  document.getElementById('loading-cards').style.display = "none";
  const deck = document.getElementById('cr-card-deck');
  deck.innerHTML = "";
  let i = 0;
  function revealNext() {
    if (i >= revealCards.length) {
      setTimeout(() => { viewBtn.style.display = "block"; }, 700);
      return;
    }
    let cardName = revealCards[i];
    let div = document.createElement('div');
    div.className = "cr-card";
    div.style.animationDelay = `${i * 0.32 + 0.12}s`;
    let img = document.createElement('img');
    img.className = "cr-image"; img.alt = cardName;
    img.src = CARD_IMAGES[cardName] || "";
    div.appendChild(img);
    let badge = document.createElement('span');
    badge.className = "cr-card-count";
    badge.textContent = "✓";
    div.appendChild(badge);

    deck.appendChild(div);
    if (interacted) { try { sfxReveal.currentTime=0;sfxReveal.play(); } catch {} }

    i++; setTimeout(revealNext, 1000);
  }
  revealNext();
}

// --- View Collection Button ---
viewBtn.onclick = () => {
  window.location.href = "redeem.html?email=" + encodeURIComponent(userEmail);
};

// Auto-start if landing from URL param
if (userEmail) setTimeout(startRevealFlow, 60);
