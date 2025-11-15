// Load assets and music
const PB = window.PB_ASSETS;
document.getElementById('logo-main').src = PB.logo;
document.getElementById('bg-music').src = PB.music.bg;
document.getElementById('sfx-redeem').src = PB.music.reveal;
document.getElementById('sfx-leader').src = PB.music.rare;

// Start bg music
window.onload = () => {
  let music = document.getElementById('bg-music');
  if(music){ music.loop = true; music.volume = 0.13; music.play(); }
};

document.addEventListener('DOMContentLoaded', async function() {
  const params = new URLSearchParams(window.location.search);
  let email = params.get('email');
  if(!email) { location.href = 'index.html'; return; }

  document.getElementById('email-hd').textContent = email;

  // Init supabase
  initSupabase();

  // Load user's cards
  // backend: query cards_earned where customer_email==email, group by card_name, sum(quantity)
  let {data:cards=[]} = await supabase
    .from('cards_earned')
    .select('card_name, is_rare, quantity')
    .eq('customer_email', email);

  // Create card map for count, and Set for unique
  const cardMap = {}, uniqueCards = new Set();
  cards.forEach(c=>{
    cardMap[c.card_name] = (cardMap[c.card_name]||0)+(c.quantity||1);
    uniqueCards.add(c.card_name);
  });

  // -- RENDER COLLECTION
  const allCardNames = Object.keys(PB.cards);
  const collectionElem = document.getElementById('collection');
  allCardNames.forEach(name=>{
    let owned = cardMap[name] > 0;
    let cardDiv = document.createElement('div');
    cardDiv.className = "card glow";
    if(!owned) cardDiv.classList.add('locked');
    // If rare add class
    if(cards.find(c=>c.card_name==name && c.is_rare)) cardDiv.classList.add('rare');

    // Card image
    let img = document.createElement('img');
    img.className = 'card-image';
    img.alt = name;
    img.src = PB.cards[name];
    cardDiv.appendChild(img);

    // Card title
    let title = document.createElement('div');
    title.className = "card-title";
    title.textContent = name;
    cardDiv.appendChild(title);

    // Count badge
    if(cardMap[name] > 1) {
      let count = document.createElement('span');
      count.className = 'card-count';
      count.textContent = "x"+cardMap[name];
      cardDiv.appendChild(count);
    }

    // Lock overlay
    if(!owned) {
      let lock = document.createElement('img');
      lock.src = PB.lockIcon;
      lock.className = "btn-lock";
      lock.alt = "locked";
      cardDiv.appendChild(lock);
    }
    collectionElem.appendChild(cardDiv);
  });

  // -- REDEMPTION CTA LOGIC
  let cta = '';
  if(uniqueCards.size < 2) {
    cta = '<div style="padding:2rem;text-align:center;"><span style="font-size:1.8em;opacity:.7;">Collect cards to unlock special rewards!</span></div>';
  } else if(uniqueCards.size < 7) {
    cta = `<div style='text-align:center;padding:1.6em;'><strong>${uniqueCards.size}</strong>/7 unique cards found! 
      <br/>Collect all 7 for special rewards!<br /><span style="font-size:2em">✨</span></div>`;
  } else {
    cta = `<button class="button" id="redeem-btn"><div><div><div>
      Redeem All 7 Cards!
    </div></div></div></button>
    <p style="margin-top:1.1em;color:#0ea5e9;font-weight:bold;font-size:1.2em;">You unlocked all legendary cards! Click to redeem your Grand Reward.</p>`;
  }
  document.getElementById('redeem-cta').innerHTML = cta;

  // Redeem logic
  if(document.getElementById('redeem-btn')) {
    document.getElementById('redeem-btn').onclick = async ()=>{
      document.getElementById('sfx-redeem').play();
      alert('🎉 Congratulations!\nYour reward will be processed (implement your backend logic here).');
      // Here you would update the DB (e.g. mark cards as redeemed, trigger webhook, etc)
      document.getElementById('redeem-btn').style.display="none";
    };
  }

  // NAV back
  document.getElementById('back-btn').onclick = ()=>{
    window.location.href = "index.html?email="+encodeURIComponent(email);
  };

  // -- LEADERBOARD
  // Query leaderboard from stats, order by unique_cards DESC
  let {data:leaders=[]} = await supabase
    .from('customer_stats')
    .select('*')
    .order('unique_cards', {ascending:false}).limit(10);

  let boardDiv = document.getElementById('leaderboard');
  let rows = leaders.map((l,i)=>`
    <div style="display:flex;align-items:center;gap:0.8em;padding:0.6em;border-radius:1em;background:#1e263569;margin-bottom:8px;box-shadow:0 0 5px #facc1550;">
      <span style="font-size:1.5em;margin-right:.6em;font-weight:bold;color:${i<3?"#facc15":"#38bdf8"};">${i==0?"👑":i+1}</span>
      <span style="font-weight:700;font-size:1.09em;">${l.customer_name||l.customer_email}</span>
      <span class="badge">x${l.unique_cards} cards</span>
    </div>
  `).join("\n");
  boardDiv.innerHTML = rows || "<div>No leaders yet...</div>";
});
