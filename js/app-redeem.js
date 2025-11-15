const RC = window.CR_CONFIG;
const CARD_NAMES = Object.keys(RC.cards);

document.getElementById('logo-main').src = RC.logo;
document.getElementById('bg-music').src = RC.sounds.bg;
document.getElementById('sfx-redeem').src = RC.sounds.reveal;
let userEmail = new URLSearchParams(location.search).get('email');
document.getElementById('col-email').textContent = userEmail ? "for " + userEmail : "";

initSupabase();
if (!window.supabase) {
  document.getElementById("col-deck").innerHTML = "<span style='color:#fff;'>Could not connect.<br/>Try later.</span>";
  throw new Error("Supabase not initialized.");
}

(async function(){
  // 1. Get all cards user has (from any order)
  let { data: cards=[] } = await supabase
    .from('cards_earned')
    .select('card_name, is_rare, quantity')
    .eq('customer_email', userEmail);

  // Count per card, Set for uniques
  const cardMap = {}, unique = new Set();
  cards.forEach(c=>{
    cardMap[c.card_name] = (cardMap[c.card_name]||0)+(c.quantity||1);
    unique.add(c.card_name);
  });

  // 2. Render ALL cards as grid (glow or blur/lock):
  const deckElem = document.getElementById('col-deck');
  deckElem.innerHTML = '';
  CARD_NAMES.forEach(name=>{
    let owned = cardMap[name] > 0;
    let quant = cardMap[name]||0;
    let rare = cards.find(c=>c.card_name==name && c.is_rare);
    let card = document.createElement('div');
    card.className = "cr-card" + (owned?(rare?" rare":""):" locked");
    // Image
    let img = document.createElement('img');
    img.className = "cr-image"; img.alt = name; img.src = RC.cards[name]||'';
    card.appendChild(img);
    // Name
    let ttl = document.createElement('div');
    ttl.className = "cr-card-title";
    ttl.textContent = name;
    card.appendChild(ttl);
    // Badge
    if(quant>1) {
      let badge = document.createElement('span');
      badge.className = "cr-card-count";
      badge.textContent = "x"+quant;
      card.appendChild(badge);
    }
    // Lock overlay for missing
    if(!owned){
      let icon = document.createElement('img');
      icon.className = "lock-icon";
      icon.src = RC.lockIcon;
      card.appendChild(icon);
    }
    deckElem.appendChild(card);
  });

  // 3. Redeem CTA
  const cta = document.getElementById('redeem-cta');
  if(unique.size < 2){
    cta.innerHTML = "<div style='padding:2em 0 2em 0;'><span style='font-size:1.4em;'>Collect cards to unlock rewards!</span></div>";
  } else if(unique.size < 7){
    cta.innerHTML = `<div style="padding:1.4em;">
      <strong>${unique.size}/7</strong> unique cards – collect all for special rewards!
    </div>`;
  } else {
    cta.innerHTML = `<button class="button cr-btn-lg" id="redeem-btn"><div><div><div>Redeem All 7 Cards!</div></div></div></button>
    <div style="margin-top:1em;color:#0ea5e9">You unlocked them all! Click for your reward.</div>`;
    document.getElementById("redeem-btn").onclick = ()=>{
      document.getElementById("sfx-redeem").play();
      alert("Congrats! Your redemption will be processed (hook your backend logic here).");
      document.getElementById("redeem-btn").disabled=true;
    }
  }

  // 4. Leaderboard
  let { data: leaders=[] } = await supabase
    .from('customer_stats')
    .select('customer_email,customer_name,unique_cards')
    .order('unique_cards', {ascending:false}).limit(10);

  let lbHtml = (leaders.map((l,i)=>`
    <div style="display:flex;align-items:center;gap:.66em;margin-bottom:7px; font-family:'Bungee',Arial;">
      <span style="font-size:1.3em;color:${i<3?"#fdc92f":"#6cebed"};">${i==0?"👑":i+1}</span>
      <span style="font-weight: 700">${l.customer_name||l.customer_email}</span>
      <span class="badge">${l.unique_cards||0} cards</span>
    </div>
  `).join("")) || "<span>No leaderboard yet.</span>");
  document.getElementById("leaderboard").innerHTML = lbHtml;

  // NAV back
  document.getElementById('back-btn').onclick = ()=>{
    location.href = "index.html?email="+encodeURIComponent(userEmail);
  };

})();
