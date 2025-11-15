const CARD_IMAGES = {
  LensWarden:  "https://email-editor-resources.s3.amazonaws.com/images/82618240/LensWarden.png",
  "Device-Keeper": "https://email-editor-resources.s3.amazonaws.com/images/82618240/Device-Keeper.png",
  "File-Forger": "https://email-editor-resources.s3.amazonaws.com/images/82618240/File-Forger.png",
  "Crown-Shaper": "https://email-editor-resources.s3.amazonaws.com/images/82618240/Crown-Shaper.png",
  "Blade-Bearer": "https://email-editor-resources.s3.amazonaws.com/images/82618240/Blade-Bearer.png",
  "Tooth-Tyrant": "https://email-editor-resources.s3.amazonaws.com/images/82618240/Tooth-Tyrant.png",
  "Quick-Cloth":  "https://email-editor-resources.s3.amazonaws.com/images/82618240/Quick-Cloth.png"
};
const LOCK_SVG = `<svg class="lock-overlay" viewBox="0 0 60 56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g opacity="0.68">
    <rect x="10" y="23" width="40" height="23" rx="7" fill="#fff" fill-opacity="0.18"/>
    <rect x="10" y="23" width="40" height="23" rx="7" stroke="#facc15" stroke-width="3"/>
    <ellipse cx="30" cy="22" rx="10" ry="12" fill="none" stroke="#facc15" stroke-width="3"/>
    <rect x="26" y="33" width="8" height="7" rx="4" fill="#facc15" fill-opacity="0.9"/>
  </g>
</svg>`;

function playSFX(type) {
  let el = document.getElementById(type === 'rare' ? 'rare-sfx' : 'reveal-sfx');
  if(el) el.currentTime = 0, el.play();
}

// Email flow
function submitEmail(e) {
  e.preventDefault();
  const email = document.getElementById('email-input').value.toLowerCase().trim();
  window.location.search = "?email=" + encodeURIComponent(email);
}
function showEmailModal() {
  document.getElementById('email-modal').classList.remove('hidden');
  document.getElementById('email-input').focus();
}

document.addEventListener('DOMContentLoaded', async function(){
  // Only show email modal if missing param
  const params = new URLSearchParams(window.location.search);
  let email = params.get('email');
  if(!email) return showEmailModal();
  document.getElementById('loading-cards').style.display = "";

  initSupabase();

  // Find latest order id for this email
  // Assumes a proper backend setup or use .magento-fetch function
  const cardRes = await fetch('/.netlify/functions/magento-fetch',{
    method:'POST', body:JSON.stringify({email}),
    headers:{'Content-Type':'application/json'}
  }).then(r=>r.json());

  if(!cardRes.success || !cardRes.order || !cardRes.order.id){
    document.getElementById('loading-cards').innerText = "No eligible order or cards found!";
    return;
  }
  // Now fetch this order's cards
  let { data:cards=[] } = await supabase
    .from('cards_earned')
    .select('card_name, is_rare, quantity')
    .eq('order_id', cardRes.order.id);

  // Animate reveal, one by one, only for actual cards earned in this order!
  const revealElem = document.getElementById('reveal-cards');
  revealElem.style.display = "";
  document.getElementById('loading-cards').style.display="none";
  let idx = 0;
  function revealOneCard() {
    if(idx >= cards.length) {
      document.getElementById('view-collection-btn').style.display = "block";
      return;
    }
    let { card_name, is_rare, quantity } = cards[idx];
    let cardDiv = document.createElement('div');
    cardDiv.className = "card glow" + (is_rare?" rare":"");
    // Card image
    let img = document.createElement('img');
    img.className = "card-image";
    img.alt = card_name;
    img.src = CARD_IMAGES[card_name] || "";
    cardDiv.appendChild(img);

    // Card title
    let title = document.createElement('div');
    title.className = "card-title";
    title.textContent = card_name;
    cardDiv.appendChild(title);

    // Count badge
    if(quantity > 1){
      let cnt = document.createElement('span');
      cnt.className = 'card-count';
      cnt.textContent = "x"+quantity;
      cardDiv.appendChild(cnt);
    }
    // SFX
    playSFX(is_rare ? "rare" : "reveal");
    revealElem.appendChild(cardDiv);
    idx++;
    setTimeout(revealOneCard, 900);
  }
  if(cards.length) revealOneCard();
  else document.getElementById('loading-cards').innerText = "No eligible cards earned!";

  // View collection btn
  document.getElementById('view-collection-btn').onclick = ()=>{
    window.location.href = "redeem.html?email="+encodeURIComponent(email);
  };

  // Music: Only play after first interaction
  document.body.addEventListener('pointerdown',function firstplay(){
    let music = document.getElementById('bg-music');
    if(music) music.play();
    document.body.removeEventListener('pointerdown',firstplay);
  });
});
