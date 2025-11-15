// === Load assets from PB_ASSETS
const cardImages = window.PB_ASSETS.cards;
const logoUrl    = window.PB_ASSETS.logo;
const fontUrl    = window.PB_ASSETS.fontUrl;
const SFX        = window.PB_ASSETS.music;

// Set up logo & music
document.getElementById('logo-main').src = logoUrl;
document.getElementById('bg-music').src = SFX.bg;
document.getElementById('sfx-reveal').src = SFX.reveal;
document.getElementById('sfx-rare').src = SFX.rare;

// Start music
window.onload = () => {
  const music = document.getElementById('bg-music');
  if(music){ music.loop = true; music.volume=0.16; music.play(); }
};

// Email collection
function submitEmail(e) {
  e.preventDefault();
  const email = document.getElementById('email-input').value.toLowerCase().trim();
  window.location.search = "?email=" + encodeURIComponent(email);
}
function showEmailModal() {
  document.getElementById('email-modal').classList.remove('hidden');
  document.getElementById('email-input').focus();
}

document.addEventListener('DOMContentLoaded', async function() {
  // Show modal if email param missing
  const params = new URLSearchParams(window.location.search);
  let email = params.get('email');
  if(!email) return showEmailModal();

  // INIT: Supabase
  initSupabase();
  const deckElem = document.getElementById('card-deck');

  // Load user's order/cards from backend
  const response = await fetch('/.netlify/functions/magento-fetch', {
    method:'POST', body:JSON.stringify({email}),
    headers: { 'Content-Type':'application/json' }
  });
  const {cards=[]} = await response.json();

  // Aggregate unique cards + count
  const cardMap = {};
  cards.forEach(c=>{
    cardMap[c.card_name] = (cardMap[c.card_name]||0)+1;
  });

  // For this demo simply animate known cards
  const allCardNames = Object.keys(cardImages); // get all
  let revealed = [];

  // Show/animate one by one
  let idx = 0;
  function revealNext() {
    if(idx >= allCardNames.length) {
      document.getElementById('view-collection-btn').style.display = "block";
      return;
    }
    const name = allCardNames[idx];
    let isOwned = cardMap[name] > 0;
    let card = document.createElement('div');
    card.className = "card glow";
    if(!isOwned) card.classList.add('locked');
    if(cards.length && cards.find(c=>c.card_name==name && c.is_rare)) card.classList.add('rare');
    // Card image
    let img = document.createElement('img');
    img.className = 'card-image';
    img.alt = name;
    img.src = cardImages[name];
    card.appendChild(img);

    // Card title
    let title = document.createElement('div');
    title.className = "card-title";
    title.textContent = name;
    card.appendChild(title);

    // If rare, badge
    if(card.classList.contains('rare')) {
      let badge = document.createElement('span');
      badge.textContent = "⭐";
      badge.className = "badge rare";
      card.appendChild(badge);
    }

    // If owned >1, show count
    if(cardMap[name] > 1) {
      let count = document.createElement('span');
      count.className = 'card-count';
      count.textContent = "x"+cardMap[name];
      card.appendChild(count);
    }

    // Lock
    if(!isOwned) {
      let lock = document.createElement('img');
      lock.src = window.PB_ASSETS.lockIcon;
      lock.className = "btn-lock";
      lock.alt = "locked";
      card.appendChild(lock);
    } else {
      // Play reveal SFX
      let sfx = document.getElementById('sfx-reveal');
      if(card.classList.contains('rare')) sfx = document.getElementById('sfx-rare');
      setTimeout(()=>sfx && sfx.play(),200);
    }

    deckElem.appendChild(card);
    idx++;
    setTimeout(revealNext, 600);
  }
  revealNext();

  // View Collection Button
  document.getElementById('view-collection-btn').onclick = ()=>{
    window.location.href = "redeem.html?email="+encodeURIComponent(email);
  };
});
