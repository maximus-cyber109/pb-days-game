// app-redeem.js
(async function() {
  'use strict';

  const config = window.CR_CONFIG;
  if (!config) { console.error("CR_CONFIG not loaded!"); return; }

  const CARD_IMAGES = config.cards;
  const ALL_CARDS = Object.keys(CARD_IMAGES); 
  const TOTAL_CARDS_TO_COLLECT = 7; 

  const urlParams = new URLSearchParams(location.search);
  let userEmail = urlParams.get('email');
  
  let userIsOverride = false;
  let overrideInfo = null;
  let uniqueEarnedCards = [];
  let mainTier = "1";
  let customerName = "";
  let lastOrderId = 'N/A';
  let redeemedItem = null;
  let redeemedCash = null;

  // --- UPDATED TIERS: 1, 2-3, 4-6, 7 ---
  function getOverrideTier(email) {
    let match = (email || '').match(/-ovrmaaz(\d(?:-\d)?)/);
    if (match) {
      const t = match[1];
      if (t === "1") return { tier: "1", cardCount: 1 };
      if (t === "2-3") return { tier: "2-3", cardCount: 3 };
      if (t === "4-6") return { tier: "4-6", cardCount: 6 };
      if (t === "7") return { tier: "7", cardCount: 7 };
    }
    return null;
  }
  
  function getTierFromCount(count) {
    return (count === 1) ? '1'
         : (count >= 2 && count <= 3) ? '2-3'  // Changed
         : (count >= 4 && count <= 6) ? '4-6'  // Changed
         : (count >= 7) ? '7' : '1';
  }

  function renderRockSlider(count) {
    const rocksContainer = document.getElementById('slider-rocks');
    const innerBar = document.getElementById('coc-progress-inner');
    const textEl = document.getElementById('slider-text');
    if (!rocksContainer) return;
    
    let rocksHtml = "";
    for (let i = 0; i < TOTAL_CARDS_TO_COLLECT; i++) {
      rocksHtml += `<span class="coc-progress-rock${i < count ? " earned" : ""}"></span>`;
    }
    rocksContainer.innerHTML = rocksHtml;
    const percentage = (count / TOTAL_CARDS_TO_COLLECT) * 100;
    innerBar.style.width = `${percentage}%`;
    textEl.innerText = `${count}/${TOTAL_CARDS_TO_COLLECT}`;
  }

  function renderCardSlider(earnedCards) {
    const container = document.getElementById('card-slider-container');
    const track = document.getElementById('card-slider-track');
    if (!container || !track) return;

    if (earnedCards.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'block';
    let cardsHtml = '';
    let cardCount = 0;
    while (cardCount < 20 || cardsHtml.length < 2000) {
        for (const cardName of earnedCards) {
            cardsHtml += `<img src="${CARD_IMAGES[cardName]}" alt="${cardName}" class="slider-card-img">`;
            cardCount++;
        }
        if (earnedCards.length === 0) break;
    }
    track.innerHTML = cardsHtml + cardsHtml;
  }

  async function renderRewardGrid() {
    const rewardSection = document.getElementById('reward-section');
    if (!rewardSection) return;
    
    rewardSection.innerHTML = "";
    if (redeemedItem || redeemedCash) return;

    if (mainTier === '1') {
      rewardSection.innerHTML = `<div class="reward-tier1-prompt">
        You're just one step away!<br>
        <span style="color:#fedc07; font-size: 1.2em;">Unlock 2+ Cards</span><br>
        to claim your first amazing rewards!
      </div>`;
    } else {
        const rewards = await window.getLiveRewardsByTier(mainTier);
        if (!rewards || rewards.length === 0) {
          rewardSection.innerHTML = `<p class="reward-tier1-prompt" style="font-size: 1rem;">
            No rewards are active for your tier right now.
            <br>Check back soon!
          </p>`;
        } else {
          for (let reward of rewards) {
            let c = document.createElement('div');
            c.className = "product-card glow";
            
            let img = new Image();
            img.className = "product-img";
            img.src = reward.image_url || config.logo;
            c.appendChild(img);
            
            let title = document.createElement('div');
            title.className = "product-name";
            title.textContent = reward.product_name;
            c.appendChild(title);
            
            let priceEl = document.createElement('div');
            priceEl.className = "product-price";
            priceEl.textContent = `₹${(reward.price || 0).toFixed(2)}`;
            c.appendChild(priceEl);
            
            let redeemBtn = document.createElement('button');
            redeemBtn.className = "btn-3d-glass";
            
            if (reward.remainingqty <= 0) {
              redeemBtn.textContent = "Already Claimed";
              redeemBtn.disabled = true;
            } else {
              redeemBtn.textContent = "Redeem";
            }
            
            redeemBtn.onclick = () => handleRedeemClick(reward, redeemBtn);
            c.appendChild(redeemBtn);
            rewardSection.appendChild(c);
          }
        }
    }
    
    const unlockCard = document.createElement('a');
    unlockCard.className = "product-card unlock-more";
    unlockCard.href = "https://pinkblue.in";
    unlockCard.target = "_blank";
    unlockCard.innerHTML = `
      <img src="https://email-editor-resources.s3.amazonaws.com/images/82618240/Logo.png" class="product-img" style="opacity: 0.5;">
      <div class="product-name">Unlock More Tiers!</div>
      <div class="product-price" style="color: #a394f5; font-size: 0.9rem; flex-grow: 1; margin-top: 1em;">Place new orders to collect all 7 cards!</div>
      <button class="btn-3d-glass" style="margin-top: 1em;">Shop Now</button>
    `;
    rewardSection.appendChild(unlockCard);
  }
  
  async function renderLeaderboard() {
    const lbContainer = document.getElementById('leaderboard');
    if (!lbContainer) return;
    let { data: leaders } = await window.supabaseClient.from('customer_stats')
      .select('customer_email,customer_name,unique_cards')
      .order('unique_cards', { ascending: false })
      .limit(10);
    
    if (!leaders) return;
    let lbHtml = (leaders.map((l, i) => `
      <div class="leaderboard-row">
        <span class="leaderboard-rank ${i === 0 ? 'first' : ''}">${i === 0 ? "👑" : i + 1}</span>
        <span class="leaderboard-name">${l.customer_name || l.customer_email.split('@')[0]}</span>
        <span class="leaderboard-score">${l.unique_cards || 0}</span>
      </div>
    `).join(""));
    lbContainer.innerHTML = lbHtml;
  }
  
  function showRedeemSuccessModal(reward) {
    const modal = document.getElementById('redeem-success-modal');
    document.getElementById('redeem-success-img').src = reward.image_url || config.logo;
    document.getElementById('redeem-success-name').textContent = reward.product_name;
    modal.classList.add('show');
    document.getElementById('redeem-success-close').onclick = () => {
      modal.classList.remove('show');
      location.reload();
    };
  }
  
  async function handleRedeemClick(reward, button) {
    button.textContent = "Checking...";
    button.disabled = true;

    try {
      // 1. Only do DB transaction (Fast)
      const response = await fetch('/.netlify/functions/redeem-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          reward: reward
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Redemption failed");
      
      button.textContent = "Redeemed!";
      
      // 2. Send Event Asynchronously (Fire & Forget)
      fetch('/.netlify/functions/send-redeem-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          type: 'reward',
          reward: reward,
          customerName: customerName,
          cardsHeldCount: uniqueEarnedCards.length
        })
      }).catch(err => console.error("Event send failed:", err));

      showRedeemSuccessModal(reward);

    } catch (err) {
      console.error("Redemption failed:", err.message);
      if (err.message.includes("stock")) button.textContent = "Out of Stock";
      else if (err.message.includes("claimed")) button.textContent = "Already Claimed";
      else {
        button.textContent = "Error! Try Again";
        button.disabled = false;
      }
    }
  }
  
  // ... (Gallery Setup & PbCash logic omitted for brevity but remains similar) ...
  // Just updated PbCash claim handler below:
  
  async function setupPbCashModal() {
    const showBtn = document.getElementById('show-pb-cash');
    const modal = document.getElementById('pb-cash-modal');
    const textEl = document.getElementById('pb-cash-text');
    const claimBtn = document.getElementById('pb-cash-claim');
    
    if (redeemedItem || redeemedCash || mainTier !== '1') {
      showBtn.style.display = 'none';
      return;
    }

    // ... (PB Cash Calc Logic Same) ...
    let pbCashAmount = 0;
    // ... Assume logic fetched amount ... 
    if(userIsOverride) pbCashAmount = 40; // Placeholder for brevity
    if(pbCashAmount <= 0) { showBtn.style.display = 'none'; return; }
    showBtn.style.display = 'block';

    showBtn.onclick = () => {
       textEl.innerText = `You earned PB CASH: ₹${pbCashAmount}`;
       modal.classList.add('show');
    }

    claimBtn.onclick = async function() {
      claimBtn.disabled = true;
      claimBtn.textContent = "Claiming...";
      
      try {
        // 1. DB Only (Fast)
        const response = await fetch('/.netlify/functions/redeem-cash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            orderIdUsed: lastOrderId,
            amount: pbCashAmount,
            customerName: customerName
          })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        claimBtn.textContent = "Claimed!";
        
        // 2. Event (Fire & Forget)
        fetch('/.netlify/functions/send-redeem-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            type: 'cash',
            amount: pbCashAmount,
            orderIdUsed: lastOrderId,
            customerName: customerName
          })
        }).catch(err => console.error("Event send failed:", err));

        modal.classList.remove('show');
        location.reload();
      } catch (err) {
        // Error handling
      }
    }
    document.getElementById('pb-cash-close').onclick = () => modal.classList.remove('show');
  }

  // ... (Gallery Setup func) ...
  function setupGalleryModal() { /* Same as before */ }

  async function mainRedeem() {
    if (!userEmail) return;
    initSupabase();
    
    // ... (Rules Modal logic) ...

    overrideInfo = getOverrideTier(userEmail);
    userIsOverride = !!overrideInfo;

    // ... (Existing redemption check logic) ...

    let allEarnedCards = [];
    // ... (Fetch cards logic) ...
    if (!userIsOverride) {
        // ... fetch from Supabase ...
        // ... fetch Magento name ...
    }
    
    // Logic mock for compilation context
    uniqueEarnedCards = []; // populated by logic above
    const uniqueCardCount = uniqueEarnedCards.length;
    mainTier = getTierFromCount(uniqueCardCount); // Uses NEW logic

    renderCardSlider(uniqueEarnedCards);
    renderRockSlider(uniqueCardCount);
    setupGalleryModal();
    
    await Promise.all([
      renderRewardGrid(),
      renderLeaderboard(),
      setupPbCashModal()
    ]);
  }

  mainRedeem();
})();
