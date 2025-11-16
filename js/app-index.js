// app-index.js

const config = window.CR_CONFIG;
const CARD_IMAGES = config.cards;
const LOGO_URL = config.logo;
const sfxReveal = document.getElementById('reveal-sfx');
const sfxRare = document.getElementById('rare-sfx');
const bgMusic = document.getElementById('bg-music');
bgMusic.src = config.sounds.bg;
sfxReveal.src = config.sounds.reveal;
sfxRare.src = config.sounds.reveal;

let userEmail = "";
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
function playSfx(sfx) {
  try { sfx.currentTime=0; sfx.play(); } catch {}
}
// Setup interaction unlock for BG music/sfx
let interacted = false;
document.body.addEventListener('pointerdown', ()=>{try{ bgMusic.play(); }catch{};interacted=true;},{once:true});
// -----

initSupabase();

function askEmail() {
  const box = document.createElement('div');
  box.className = "modal-bg show";
  box.innerHTML = `<div class="modal-fg" style="padding:2em 1em;">
      <div class="pb-cash-text">Enter your email to claim your PB Days cards!</div>
      <form id="email-form"><input type="email" required placeholder="Your Email" style="font-family:'Bungee Spice',sans-serif;font-size:1.18em;border-radius:14px;padding:.8em 1.5em;border:2px solid #ccd;" id="email-input" /><br><button class="btn-aqua btn-aqua-large" style="margin-top:1.2em;">Begin Card Reveal</button></form>
    </div>`;
  document.body.appendChild(box);
  box.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    userEmail = box.querySelector('#email-input').value.trim().toLowerCase();
    box.remove();
    startRevealFlow();
  }
}

function emailCheck() {
  const urlParams = new URLSearchParams(window.location.search);
  let email = urlParams.get("email");
  if (!email) {
    askEmail();
    return false;
  }
  userEmail = email.toLowerCase();
  return true;
}

if (emailCheck()) setTimeout(startRevealFlow, 80);

// --- MAIN CARD REVEAL LOGIC ---

async function startRevealFlow() {
  const stage = document.getElementById('reveal-stage');
  if (!stage) return;

  // 1. Which cards to reveal?
  let override = getOverrideTier(userEmail);
  userIsOverride = !!override;
  let cardNames = Object.keys(config.cards);
  let revealCards = [];
  if (userIsOverride && override) {
    overrideCards = cardNames.slice(0, override.numCards);
    revealCards = overrideCards;
  } else {
    // Fetch SKUs and segments for given email (call your own lambda/Netlify function, returns {skus:[], prices:[], segments:[]} )
    let res = await fetch('/.netlify/functions/magento-fetch', {
      method: "POST",
      body: JSON.stringify({ email: userEmail }),
      headers: { 'Content-Type': 'application/json' }
    });
    let data = await res.json();
    let skus = data.skus || [];
    let segs = data.segment_codes || [];
    if (!skus.length || !segs.length) {
      stage.innerHTML = `<div style="margin-top:100px;font-size:1.09em;color:#eee;text-align:center;">Could not find eligible cards for this order/email.</div>`;
      return;
    }
    // Map segments to card names via segment_cards table
    let { data: segCards = [] } = await supabase.from('segment_cards').select('segment_code,card_name');
    let segMap = {};
    segCards.forEach(s=>segMap[s.segment_code]=s.card_name);
    revealCards = Array.from(new Set(segs.map(s=>segMap[s] || cardNames.find(c=>c.toLowerCase().includes(s.toLowerCase()))))).filter(Boolean);
    // Insert grant to cards_earned for real users (if not already present)
    for(const card of revealCards){
      let { data: existing } = await supabase.from('cards_earned').select('id').eq('customer_email', userEmail).eq('card_name', card);
      if(!existing.length){
        await supabase.from('cards_earned').insert({
          customer_email: userEmail,
          card_name: card,
          earned_at: new Date().toISOString()
        });
      }
    }
  }
  // 2. Reveal animation: one card at center, animate back to 2x2 slots
  let gridMap = [
    {x: '10%', y: '12%'}, {x: '60%', y: '12%'}, {x: '10%', y: '62%'}, {x: '60%', y: '62%'}
  ];
  let numCards = revealCards.length;
  let lockCount = 4 - numCards; // always build a 2x2, fill the rest as locked
  stage.innerHTML = '';
  let grid = document.createElement('div'); grid.className="reveal-card-grid";
  // Fill filled+locked
  let slots = [];
  for(let i=0;i<revealCards.length;i++) slots.push({name: revealCards[i], owned: true});
  for(let i=0;i<lockCount;i++) slots.push({name:'', owned:false});
  for(let i=0;i<slots.length;i++) {
    let img = document.createElement('img');
    img.className = "reveal-card-static";
    img.src = slots[i].owned ? CARD_IMAGES[slots[i].name] : config.fallbackCardImg || "";
    if (slots[i].owned) img.classList.add('revealed');
    else img.classList.add('locked');
    img.style.gridArea = "auto";
    grid.appendChild(img);
  }
  stage.appendChild(grid);

  // Now animate each card in:
  async function revealOne(i) {
    if (i>=numCards) {
      document.getElementById('reveal-redeem-btn').style.display = "block";
      return;
    }
    let cardName = revealCards[i];
    let big = document.createElement('img');
    big.className = "reveal-card-big";
    big.style.opacity = '0';
    big.src = CARD_IMAGES[cardName] || "";
    stage.appendChild(big);
    setTimeout(()=>{big.style.opacity='1';},160);
    playSfx(sfxReveal);
    setTimeout(()=>{
      big.style.opacity='0';
      setTimeout(()=>{
        big.remove();
        // animate grid cell glow
        let revealImgs = grid.querySelectorAll('.revealed');
        if(revealImgs[i]) {
          revealImgs[i].style.boxShadow="0 0 65px #cfa,0 0 27px #00fe";
          setTimeout(()=>{revealImgs[i].style.boxShadow="";},390);
        }
        revealOne(i+1);
      },420);
    },1000);
  }
  revealOne(0);
}

// Redeem button
document.getElementById('reveal-redeem-btn').onclick = () =>
  window.location.href = "redeem.html?email=" + encodeURIComponent(userEmail);
