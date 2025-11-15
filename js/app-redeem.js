const RC = window.CR_CONFIG;
const CARD_NAMES = Object.keys(RC.cards);

document.getElementById('logo-main').src = RC.logo;
document.getElementById('bg-music').src = RC.sounds.bg;
document.getElementById('sfx-redeem').src = RC.sounds.reveal;

let userEmail = new URLSearchParams(location.search).get('email');
document.getElementById('email-display').textContent = userEmail ? userEmail : "Guest";

// Allow music on first click
function allowBGMusic(){
  let m = document.getElementById('bg-music');
  if(m && m.paused){ try{ m.play(); }catch{} }
}
document.body.addEventListener('pointerdown', allowBGMusic, {once:true});

initSupabase();
if (!window.supabase) {
  document.getElementById("col-deck").innerHTML = "<span style='color:#c82b11;'>Could not connect.</span>";
  throw new Error("Supabase not initialized.");
}

(async function(){
  // 1. Get all cards user has
  let { data: cards=[] } = await supabase
    .from('cards_earned')
    .select('card_name, is_rare, quantity')
    .eq('customer_email', userEmail);

  const cardMap = {}, unique = new Set();
  cards.forEach(c=>{
    cardMap[c.card_name] = (cardMap[c.card_name]||0)+(c.quantity||1);
    unique.add(c.card_name);
  });

  // 2. Render ALL 7 cards (owned = glow, missing = blur/lock)
  const deckElem = document.getElementById('col-deck');
  deckElem.innerHTML = '';
  CARD_NAMES.forEach(name=>{
    let owned = cardMap[name]>0;
    let quant = cardMap[name]||0;
    let rare = cards.find(c=>c.card_name==name && c.is_rare);

    let card = document.createElement('div');
    card.className = "cr-card" + (owned?(rare?" rare":""):" locked");
    
    let img = document.createElement('img');
    img.className = "cr-image"; img.alt = name; img.src = RC.cards[name]||'';
    card.appendChild(img);
    
    let ttl = document.createElement('div');
    ttl.className = "cr-card-title"; ttl.textContent = name;
    card.appendChild(ttl);
    
    if(quant>1) {
      let badge = document.createElement('span');
      badge.className = "cr-card-count"; badge.textContent = "x"+quant;
      card.appendChild(badge);
    }
    
    if(!owned) {
      let lock = document.createElement('img');
      lock.className = "lock-icon";
      lock.src = RC.lockIcon;
      card.appendChild(lock);
    }
    deckElem.appendChild(card);
  });

  // 3. Redeem CTA
  const cta = document.getElementById('redeem-cta');
  if(unique.size<2){
    cta.innerHTML = "<span style='color:#c82b11;font-weight:bold;font-family:Bungee,Arial,sans-serif;'>Collect cards to unlock special rewards!</span>";
  } else if(unique.size<7){
    cta.innerHTML = `<div style="color:#c82b11;font-weight:bold;font-family:Bungee,Arial,sans-serif;font-size:1.1em;">
      ${unique.size}/7 unique cards — collect all for rewards!
    </div>`;
  } else {
    cta.innerHTML = `<button class="cr-btn-solid" id="redeem-btn" style="background:#da2f11;color:#fff;">REDEEM ALL 7 CARDS!</button>
    <p style="margin-top:.6em;color:#c82b11;font-weight:bold;">You've unlocked them all! Claim your reward.</p>`;
    document.getElementById("redeem-btn").onclick = ()=>{
      document.getElementById("sfx-redeem").play();
      alert("🎉 Congratulations! Your redemption will be processed.");
      document.getElementById("redeem-btn").disabled=true;
    }
  }

  // 4. Leaderboard
  let { data: leaders=[] } = await supabase
    .from('customer_stats')
    .select('customer_email,customer_name,unique_cards')
    .order('unique_cards', {ascending:false}).limit(10);

  let lbHtml = (leaders.map((l,i)=>`
    <div style="display:flex;align-items:center;gap:.44em;margin-bottom:.8em;padding:.55em .66em;background:#f8f7f366;border-radius:.88em;border:1px solid #e9dac7;">
      <span style="font-size:1.26em;color:${i<3?"#da2f11":"#8a7f76"};font-family:Bungee,Arial,sans-serif;font-weight:bold;min-width:32px;">${i==0?"👑":i+1}</span>
      <span style="flex:1;font-family:Merriweather,serif;font-weight:600;color:#38312C;">${l.customer_name||l.customer_email}</span>
      <span style="background:#da2f11;color:#fff;padding:.31em .66em;border-radius:.6em;font-family:Bungee,Arial,sans-serif;font-size:.92em;font-weight:bold;">${l.unique_cards||0}</span>
    </div>
  `).join("")) || "<span style='color:#999;'>No leaderboard yet.</span>";
  document.getElementById("leaderboard").innerHTML = lbHtml;

  // NAV back
  document.getElementById('back-btn').onclick = ()=>location.href="index.html?email="+encodeURIComponent(userEmail);
})();
