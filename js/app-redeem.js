// app-redeem.js
(async function() {
  'use strict';

  const config = window.CR_CONFIG;
  if (!config) {
    console.error("CR_CONFIG not loaded!");
    return;
  }

  const CARD_IMAGES = config.cards;
  const ALL_CARDS = Object.keys(CARD_IMAGES); 
  const TOTAL_CARDS_TO_COLLECT = 7; 

  let userEmail = new URLSearchParams(location.search).get('email');
  let userIsOverride = false;
  let overrideInfo = null;
  let userCards = []; 
  let mainTier = "1";
  let customerName = ""; // For Webengage

  // --- Webengage Init REMOVED ---
  
  // --- Utility ---
  function getOverrideTier(email) {
    let match = (email || '').match(/-ovrmaaz(\d(?:-\d)?)/);
    if (match) {
      const t = match[1];
      if (t === "1") return { tier: "1", cardCount: 1 };
      if (t === "2-4") return { tier: "2-4", cardCount: 3 };
      if (t === "5-6") return { tier: "5-6", cardCount: 6 };
      if (t === "7") return { tier: "7", cardCount: 7 };
    }
    return null;
  }
  
  // --- UI Rendering ---

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
    // Create a long track for smooth scrolling
    while (cardCount < 20 || cardsHtml.length < 2000) { // Ensure it's long enough
        for (const cardName of earnedCards) {
            cardsHtml += `<img src="${CARD_IMAGES[cardName]}" alt="${cardName}" class="slider-card-img">`;
            cardCount++;
        }
        if (earnedCards.length === 0) break; 
    }
    
    track.innerHTML = cardsHtml + cardsHtml; // Duplicate track for seamless loop
  }

  // FIX: Restored the missing renderRewardGrid function
  async function renderRewardGrid() {
    const rewardSection = document.getElementById('reward-section');
    if (!rewardSection) return;
    
    rewardSection.innerHTML = "";
    
    // NEW: Psychological Trigger for Tier 1
    if (mainTier === '1') {
      rewardSection.innerHTML = `<div class="reward-tier1-prompt">
        You're just one step away!<br>
        <span style="color:#fedc07; font-size: 1.2em;">Unlock 2+ Cards</span><br>
        to claim your first amazing rewards!
      </div>`;
      return; // Stop here for Tier 1
    }
    
    const rewards = await window.getLiveRewardsByTier(mainTier);
    
    if (!rewards || rewards.length === 0) {
      rewardSection.innerHTML = `<p class="reward-tier1-prompt" style="font-size: 1rem;">
        No rewards are active for this tier right now.
        <br>Check back soon!
      </p>`;
      return;
    }
    
    // FIX: This code was moved from renderCardSlider
    let { data: redeemedSKUsData } = await window.supabaseClient.from('rewards_redeemed')
        .select('sku')
        .eq('email', userEmail);
    const redeemedSKUs = redeemedSKUsData ? redeemedSKUsData.map(r => r.sku) : [];
    
    for (let reward of rewards) {
      let c = document.createElement('div');
      c.className = "product-card glow";
      
      let img = document.createElement('img');
      img.className = "product-img";
      img.src = reward.image_url || config.logo;
      img.alt = reward.product_name;
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
      
      if (redeemedSKUs.includes(reward.sku)) {
        redeemBtn.textContent = "Redeemed";
        redeemBtn.disabled = true;
      } else if (reward.remainingqty <= 0) {
        redeemBtn.textContent = "Out of Stock";
        redeemBtn.disabled = true;
      } else {
        redeemBtn.textContent = "Redeem";
        redeemBtn.disabled = false;
      }
      
      redeemBtn.onclick = () => handleRedeemClick(reward, redeemBtn);
      c.appendChild(redeemBtn);
      rewardSection.appendChild(c);
    }
  }
  
  async function renderLeaderboard() {
    const lbContainer = document.getElementById('leaderboard');
    if (!lbContainer) return;
    
    // FIX: Use the global client
    let { data: leaders, error } = await window.supabaseClient.from('customer_stats')
      .select('customer_email,customer_name,unique_cards')
      .order('unique_cards', { ascending: false })
      .limit(10);
      
    if (error) {
      console.error("Leaderboard error:", error);
      lbContainer.innerHTML = "<p>Leaderboard loading failed.</p>";
      return;
    }

    let lbHtml = (leaders.map((l, i) => `
      <div class="leaderboard-row">
        <span class="leaderboard-rank ${i === 0 ? 'first' : ''}">${i === 0 ? "👑" : i + 1}</span>
        <span class="leaderboard-name">${l.customer_name || l.customer_email.split('@')[0]}</span>
        <span class="leaderboard-score">${l.unique_cards || 0}</span>
      </div>
    `).join(""));
    
    lbContainer.innerHTML = lbHtml;
  }
  
  function renderShopMoreButton() {
    const leaderboardEl = document.getElementById("leaderboard");
    if (!leaderboardEl) return;
    
    const shopMoreBtn = document.createElement('a');
    shopMoreBtn.href = "https://pinkblue.in";
    shopMoreBtn.className = "btn-3d-glass shop-more-btn";
    shopMoreBtn.textContent = "Shop More";
    shopMoreBtn.target = "_blank";
    shopMoreBtn.rel = "noopener noreferrer";
    
    leaderboardEl.parentNode.insertBefore(shopMoreBtn, leaderboardEl.nextSibling);
  }

  // --- Event Handlers & Logic ---

  // NEW: Show success modal
  function showRedeemSuccessModal(reward) {
    const modal = document.getElementById('redeem-success-modal');
    document.getElementById('redeem-success-img').src = reward.image_url || config.logo;
    document.getElementById('redeem-success-name').textContent = reward.product_name;
    // The delivery text is now part of the HTML
    modal.classList.add('show');
    
    document.getElementById('redeem-success-close').onclick = () => {
      modal.classList.remove('show');
    };
  }

  async function handleRedeemClick(reward, button) {
    button.textContent = "Checking...";
    button.disabled = true;

    try {
      // FIX: Use the global client
      let { data: product, error: fetchError } = await window.supabaseClient
        .from('reward_products')
        .select('remainingqty')
        .eq('sku', reward.sku)
        .single();

      if (fetchError || product.remainingqty <= 0) {
        button.textContent = "Out of Stock";
        throw new Error("Reward is out of stock.");
      }

      const newQty = product.remainingqty - 1;
      // FIX: Use the global client
      let { error: updateError } = await window.supabaseClient
        .from('reward_products')
        .update({ remainingqty: newQty })
        .eq('sku', reward.sku);
        
      if (updateError) throw updateError;

      // FIX: Use the global client
      let { error: logError } = await window.supabaseClient
        .from('rewards_redeemed')
        .insert({
          email: userEmail,
          sku: reward.sku,
          product_name: reward.product_name,
          tier: reward.tier,
          reward_time: new Date().toISOString()
        });
        
      if (logError) throw logError;

      button.textContent = "Redeemed!";
      
      // SHOW SUCCESS MODAL
      showRedeemSuccessModal(reward);

      // SEND WEBENGAGE EVENT
      if (typeof webengage !== "undefined") {
        // webengage.track('pb_reward_redeemed', { ... }); REMOVED
        console.log("Webengage event removed. Would have tracked reward:", reward.product_name);
      }
      
    } catch (err) {
      console.error("Redemption failed:", err.message);
      if (button.textContent !== "Out of Stock") {
        button.textContent = "Error! Try Again";
        button.disabled = false;
      }
    }
  }

  function setupGalleryModal() {
    const modal = document.getElementById('gallery-modal');
    const cardImg = document.getElementById('gallery-card-img');
    const cardNameEl = document.getElementById('gallery-card-name');
    const openBtn = document.getElementById('open-gallery');
    
    // This will now work
    if (!modal || !cardImg || !cardNameEl || !openBtn) {
        console.error("Gallery modal elements missing!");
        return;
    }
    
    let galleryIdx = 0;

    function updateGallery(idx) {
      let cardName = ALL_CARDS[idx];
      cardImg.src = CARD_IMAGES[cardName];
      cardNameEl.innerText = cardName.replace(/-/g, " ");
      
      if (userCards.includes(cardName)) {
        cardImg.className = "gallery-card-img revealed";
      } else {
        cardImg.className = "gallery-card-img locked";
      }
    }

    openBtn.onclick = function() {
      galleryIdx = userCards.length ? ALL_CARDS.indexOf(userCards[0]) : 0;
      if (galleryIdx === -1) galleryIdx = 0;
      updateGallery(galleryIdx);
      modal.classList.add('show');
    }
    document.getElementById('gallery-left').onclick = function() {
      galleryIdx = (galleryIdx + ALL_CARDS.length - 1) % ALL_CARDS.length;
      updateGallery(galleryIdx);
    }
    document.getElementById('gallery-right').onclick = function() {
      galleryIdx = (galleryIdx + 1) % ALL_CARDS.length;
      updateGallery(galleryIdx);
    }
    document.getElementById('gallery-close').onclick = function() {
      modal.classList.remove('show');
    }
  }
  
  async function setupPbCashModal() {
    const showBtn = document.getElementById('show-pb-cash');
    const modal = document.getElementById('pb-cash-modal');
    const textEl = document.getElementById('pb-cash-text');
    const claimBtn = document.getElementById('pb-cash-claim');
    
    let pbCashAmount = 0;
    
    if (mainTier !== '1') {
      showBtn.style.display = 'none';
      return;
    }
    
    // FIX: Use the global client
    let { data: claimed, error } = await window.supabaseClient.from('pb_cash')
      .select('id')
      .eq('email', userEmail);
      
    if (claimed && claimed.length > 0) {
      showBtn.textContent = "PB Cash Claimed";
      showBtn.disabled = true;
      showBtn.style.display = 'block';
      showBtn.style.opacity = 0.7;
      return;
    }
    
    if (userIsOverride) {
      pbCashAmount = 40;
    } else {
      let orderData;
      try {
        orderData = await fetch('/.netlify/functions/magento-fetch', {
          method: "POST", body: JSON.stringify({ email: userEmail }), headers: { 'Content-Type': 'application/json' }
        }).then(res => res.json());

        if (orderData && orderData.success) {
          if(orderData.customer_name) {
            customerName = orderData.customer_name;
            // webengage.user.setAttribute('we_customer_name', customerName); REMOVED
          }

          if (orderData.order.items) {
            // FIX: Use the global client
            let { data: prods } = await window.supabaseClient.from('products_ordered')
              .select('p_code, product_price')
              .in('p_code', orderData.order.items.map(i => i.sku));
              
            if (prods) {
              pbCashAmount = window.calculatePbCash(prods);
            }
          }
        } else {
          console.warn("Could not get order data for PB cash calc:", (orderData && orderData.error) || "No order data");
        }
      } catch (err) {
        console.error("Failed to fetch order for PB cash:", err);
      }
    }
    
    if (pbCashAmount <= 0) {
      showBtn.style.display = 'none';
      return;
    }
    
    showBtn.style.display = 'block';
    
    showBtn.onclick = function() {
      textEl.innerText = `You earned PB CASH: ₹${pbCashAmount || '0'}`;
      modal.classList.add('show');
    }
    
    claimBtn.onclick = async function() {
      claimBtn.disabled = true;
      claimBtn.textContent = "Claiming...";
      
      // FIX: Use the global client
      let { error } = await window.supabaseClient.from('pb_cash').insert({ 
        email: userEmail, 
        amount: pbCashAmount, 
        reward_time: new Date().toISOString() 
      });
      
      if (error) {
        console.error("PB Cash claim error:", error);
        claimBtn.textContent = "Error! Try Again";
        claimBtn.disabled = false;
      } else {
        claimBtn.textContent = "Claimed!";
        modal.classList.remove('show');
        showBtn.textContent = "PB Cash Claimed";
        showBtn.disabled = true;
        showBtn.style.opacity = 0.7;

        // webengage.track('pb_cash_redeemed', { ... }); REMOVED
        if (typeof webengage !== "undefined") {
          console.log("Webengage event removed. Would have tracked PB Cash:", pbCashAmount);
        }
      }
    }
    
    document.getElementById('pb-cash-close').onclick = function() {
      modal.classList.remove('show');
    }
  }

  // --- Main Execution ---
  async function mainRedeem() {
    if (!userEmail) {
      document.body.innerHTML = `<div class="pb-cash-text" style="padding-top: 100px; text-align:center;">No email provided. Please go back to the reveal page.</div>`;
      return;
    }

    initSupabase();
    
    overrideInfo = getOverrideTier(userEmail);
    userIsOverride = !!overrideInfo;

    // 1. Fetch user's cards
    if (userIsOverride) {
      userCards = ALL_CARDS.slice(0, overrideInfo.cardCount);
    } else {
      // FIX: Use the global client
      let { data: earned, error } = await window.supabaseClient.from('cards_earned')
        .select('card_name')
        .eq('customer_email', userEmail);
      
      if (error) {
        console.error("Error fetching user cards:", error);
        return;
      }
      userCards = [...new Set(earned.map(c => c.card_name))];
    }
    
    console.log("User owns cards:", userCards);

    // 2. Determine user's tier
    const cardCount = userCards.length;
    mainTier =  (cardCount === 1) ? '1'
            : (cardCount >= 2 && cardCount <= 4) ? '2-4'
            : (cardCount >= 5 && cardCount <= 6) ? '5-6'
            : (cardCount >= 7) ? '7' : '1';
    
    console.log(`User tier: ${mainTier} (${cardCount} cards)`);

    // 3. Render all UI components
    renderCardSlider(userCards);
    renderRockSlider(cardCount);
    setupGalleryModal(); // This will now work
    
    // Run all async renders
    await Promise.all([
      renderRewardGrid(),
      renderLeaderboard(),
      setupPbCashModal() // This fetches customerName
    ]);
    
    renderShopMoreButton();

  } // end mainRedeem

  mainRedeem();

})();
