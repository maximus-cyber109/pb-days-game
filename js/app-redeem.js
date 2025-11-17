// app-redeem.js
(async function() {
  'use strict';

  // --- CONFIG & GLOBAL VARS ---
  const config = window.CR_CONFIG;
  if (!config) {
    console.error("CR_CONFIG not loaded!");
    return;
  }

  const CARD_IMAGES = config.cards;
  const ALL_CARDS = Object.keys(CARD_IMAGES); 
  const TOTAL_CARDS_TO_COLLECT = 7; 

  const urlParams = new URLSearchParams(location.search);
  let userEmail = urlParams.get('email');
  // OrderId is REMOVED. Redemption is per-customer.
  
  let userIsOverride = false;
  let overrideInfo = null;
  
  // This will store the *unique* cards the user has *ever* earned
  let uniqueEarnedCards = [];
  
  let mainTier = "1";
  let customerName = "";
  let lastOrderId = 'N/A'; // For logging PB Cash claims
  
  // NEW: Placeholders for redeemed items
  let redeemedItem = null;
  let redeemedCash = null;

  // --- UTILITY ---
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
  
  function getTierFromCount(count) {
    return (count === 1) ? '1'
         : (count >= 2 && count <= 4) ? '2-4'
         : (count >= 5 && count <= 6) ? '5-6'
         : (count >= 7) ? '7' : '1';
  }

  // --- UI RENDERING ---
  function renderRockSlider(count) {
    const rocksContainer = document.getElementById('slider-rocks');
    const innerBar = document.getElementById('coc-progress-inner');
    const textEl = document.getElementById('slider-text');
    if (!rocksContainer || !innerBar || !textEl) {
        console.error("Progress bar elements not found!");
        return;
    }
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
    // Loop until the track is very long for a smooth scroll
    while (cardCount < 20 || cardsHtml.length < 2000) {
        for (const cardName of earnedCards) {
            cardsHtml += `<img src="${CARD_IMAGES[cardName]}" alt="${cardName}" class="slider-card-img">`;
            cardCount++;
        }
        if (earnedCards.length === 0) break; // Safety break
    }
    track.innerHTML = cardsHtml + cardsHtml; // Duplicate track for seamless loop
  }

  async function renderRewardGrid() {
    const rewardSection = document.getElementById('reward-section');
    if (!rewardSection) return;
    
    rewardSection.innerHTML = ""; // Clear it
    
    // **NEW**: If already redeemed, we skip this
    if (redeemedItem || redeemedCash) {
      return;
    }

    if (mainTier === '1') {
      // User has 1 card, show "Unlock More" prompt
      rewardSection.innerHTML = `<div class="reward-tier1-prompt">
        You're just one step away!<br>
        <span style="color:#fedc07; font-size: 1.2em;">Unlock 2+ Cards</span><br>
        to claim your first amazing rewards!
      </div>`;
      // Don't return, user might be eligible for PB Cash
    } else {
        // User has 2+ cards, fetch rewards for their tier
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
            
            if (reward.remainingqty <= 0) {
              // CHANGED: Button text
              redeemBtn.textContent = "Already Claimed";
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
    }

    // **NEW: Always add the "Unlock More" tile**
    const unlockCard = document.createElement('a');
    unlockCard.className = "product-card unlock-more";
    unlockCard.href = "https://pinkblue.in";
    unlockCard.target = "_blank";
    unlockCard.rel = "noopener noreferrer";
    unlockCard.innerHTML = `
      <img src="https://email-editor-resources.s3.amazonaws.com/images/82618240/Logo.png" alt="Unlock More" class="product-img" style="opacity: 0.5;">
      <div class="product-name">Unlock More Tiers!</div>
      <div class="product-price" style="color: #a394f5; font-size: 0.9rem; flex-grow: 1; margin-top: 1em;">Place new orders to collect all 7 cards and reach the top rewards.</div>
      <button class="btn-3d-glass" style="margin-top: 1em;">Shop Now</button>
    `;
    rewardSection.appendChild(unlockCard);
  }
  
  async function renderLeaderboard() {
    const lbContainer = document.getElementById('leaderboard');
    if (!lbContainer) return;
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
  
  // --- Event Handlers & Logic ---

  function showRedeemSuccessModal(reward) {
    const modal = document.getElementById('redeem-success-modal');
    document.getElementById('redeem-success-img').src = reward.image_url || config.logo;
    document.getElementById('redeem-success-name').textContent = reward.product_name;
    modal.classList.add('show');
    document.getElementById('redeem-success-close').onclick = () => {
      modal.classList.remove('show');
      // Reload the page to show the "already redeemed" message
      location.reload();
    };
  }
  
  // **LOGIC CHANGE: Calls new Netlify Function**
  async function handleRedeemClick(reward, button) {
    button.textContent = "Checking...";
    button.disabled = true;

    try {
      // Call the backend function to handle everything
      const response = await fetch('/.netlify/functions/redeem-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          customerName: customerName,
          cardsHeldCount: uniqueEarnedCards.length,
          reward: reward // Pass the full reward object
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Redemption failed");
      }
      
      // Success!
      button.textContent = "Redeemed!";
      showRedeemSuccessModal(reward);

    } catch (err) {
      console.error("Redemption failed:", err.message);
      if (err.message.includes("stock")) {
        button.textContent = "Out of Stock";
      } else if (err.message.includes("claimed")) {
        button.textContent = "Already Claimed";
      } else {
        button.textContent = "Error! Try Again";
        button.disabled = false; // Let them try again
      }
    }
  }


  function setupGalleryModal() {
    const modal = document.getElementById('gallery-modal');
    const cardImg = document.getElementById('gallery-card-img');
    const cardNameEl = document.getElementById('gallery-card-name');
    const openBtn = document.getElementById('open-gallery');
    
    if (!modal || !cardImg || !cardNameEl || !openBtn) {
        console.error("Gallery modal elements missing!");
        return;
    }
    
    let galleryIdx = 0;

    function updateGallery(idx) {
      if (uniqueEarnedCards.length === 0) {
          cardNameEl.innerText = "No Cards Yet";
          cardImg.src = config.logo;
          return;
      }
        
      let cardName = uniqueEarnedCards[idx];
      cardImg.src = CARD_IMAGES[cardName];
      cardNameEl.innerText = cardName.replace(/-/g, " ");
      cardImg.className = "gallery-card-img revealed";
    }

    openBtn.onclick = function() {
      galleryIdx = 0;
      updateGallery(galleryIdx);
      modal.classList.add('show');
    }
    document.getElementById('gallery-left').onclick = function() {
      if (uniqueEarnedCards.length === 0) return;
      galleryIdx = (galleryIdx + uniqueEarnedCards.length - 1) % uniqueEarnedCards.length;
      updateGallery(galleryIdx);
    }
    document.getElementById('gallery-right').onclick = function() {
      if (uniqueEarnedCards.length === 0) return;
      galleryIdx = (galleryIdx + 1) % uniqueEarnedCards.length;
      updateGallery(galleryIdx);
    }
    document.getElementById('gallery-close').onclick = function() {
      modal.classList.remove('show');
    }
  }
  
  // **LOGIC CHANGE: Checks for "one-shot" redemption**
  async function setupPbCashModal() {
    const showBtn = document.getElementById('show-pb-cash');
    const modal = document.getElementById('pb-cash-modal');
    const textEl = document.getElementById('pb-cash-text');
    const claimBtn = document.getElementById('pb-cash-claim');
    
    // **NEW**: If already redeemed, hide
    if (redeemedItem || redeemedCash) {
      showBtn.style.display = 'none';
      return;
    }
    
    // Only show PB Cash button if this user is Tier 1
    if (mainTier !== '1') {
      showBtn.style.display = 'none';
      return;
    }
    
    let pbCashAmount = 0;
    
    if (userIsOverride) {
      pbCashAmount = 40;
    } else {
      let orderData;
      try {
        // Fetch *this specific order's* details
        orderData = await fetch('/.netlify/functions/magento-fetch', {
          method: "POST", body: JSON.stringify({ email: userEmail, orderId: lastOrderId }), headers: { 'Content-Type': 'application/json' }
        }).then(res => res.json());

        if (orderData && orderData.success) {
          if(orderData.customer_name) customerName = orderData.customer_name;

          if (orderData.order.items) {
            let { data: prods } = await window.supabaseClient.from('products_ordered')
              .select('p_code, product_price')
              .in('p_code', orderData.order.items.map(i => i.sku));
              
            if (prods) {
              pbCashAmount = window.calculatePbCash(prods);
            }
          }
        } else {
          console.warn("Could not get order data for PB cash calc:", (orderData && orderData.error));
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
      
      try {
        // **LOGIC CHANGE: Call new backend function**
        const response = await fetch('/.netlify/functions/redeem-cash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            customerName: customerName,
            orderIdUsed: lastOrderId,
            amount: pbCashAmount
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Claim failed");
        }

        // Success!
        claimBtn.textContent = "Claimed!";
        
        // **WEBENGAGE EVENT REMOVED from frontend**

        modal.classList.remove('show');
        // Reload the page to show the "already redeemed" message
        location.reload();

      } catch (err) {
        console.error("PB Cash claim error:", err.message);
        if (err.message.includes("claimed")) {
          claimBtn.textContent = "Already Claimed";
        } else {
          claimBtn.textContent = "Error! Try Again";
          claimBtn.disabled = false;
        }
      }
    }
    
    document.getElementById('pb-cash-close').onclick = function() {
      modal.classList.remove('show');
    }
  }

  // --- Initialization ---
  async function mainRedeem() {
    if (!userEmail) {
      document.body.innerHTML = `<div class="pb-cash-text" style="padding-top: 100px; text-align:center;">No email provided. Go back and enter your email.</div>`;
      return;
    }

    initSupabase();

    // REMOVED Webengage Login
    
    overrideInfo = getOverrideTier(userEmail);
    userIsOverride = !!overrideInfo;

    // 1. Check for ANY existing redemption for this customer
    if (!userIsOverride) {
      const { data: existingRedemption, error: checkError } = await window.supabaseClient
          .from('rewards_redeemed')
          // **NEW: Fetch SKU to get image**
          .select('reward_name, reward_sku')
          .eq('customer_email', userEmail)
          .single();
          
      const { data: existingCash, error: cashCheckError } = await window.supabaseClient
          .from('pb_cash')
          .select('amount')
          .eq('customer_email', userEmail)
          .single();

      if (existingRedemption) {
        redeemedItem = existingRedemption; // Store it
        document.getElementById('redemption-area').style.display = 'none';
        const msgEl = document.getElementById('already-redeemed-area');
        
        // **NEW: Fetch image for redeemed product**
        const { data: product } = await window.supabaseClient
          .from('reward_products')
          .select('image_url')
          .eq('sku', redeemedItem.reward_sku)
          .single();

        document.getElementById('redeemed-item-img').src = product ? product.image_url : config.logo;
        document.getElementById('redeemed-item-message').innerHTML = `You have already claimed your one-time reward:<br><strong style="color:#fedc07; font-size: 1.2em;">${redeemedItem.reward_name}</strong>`;
        msgEl.style.display = 'block';

      } else if (existingCash) {
        redeemedCash = existingCash; // Store it
        document.getElementById('redemption-area').style.display = 'none';
        const msgEl = document.getElementById('already-redeemed-area');
        
        // **NEW: Show cash icon**
        document.getElementById('redeemed-item-img').src = 'https://placehold.co/150x150/fdd835/3f227b?text=PB%20CASH';
        document.getElementById('redeemed-item-message').innerHTML = `You have already claimed your one-time reward:<br><strong style="color:#fedc07; font-size: 1.2em;">PB Cash ₹${redeemedCash.amount}</strong>`;
        msgEl.style.display = 'block';
      }
    }

    // 2. Fetch *all* user's earned cards
    let allEarnedCards = [];
    
    if (userIsOverride) {
      for(let i = 0; i < overrideInfo.cardCount; i++) allEarnedCards.push(ALL_CARDS[i]);
      if(overrideInfo.cardCount > 1) allEarnedCards.push(ALL_CARDS[0]); // Add duplicate for testing
      
    } else {
      const { data: earnedData, error: earnedError } = await window.supabaseClient
        .from('cards_earned')
        .select('card_name, order_id')
        .eq('customer_email', userEmail)
        .order('earned_at', { ascending: false }); // Get newest first
        
      if (earnedError) {
        console.error("Error fetching card data:", earnedError);
        return;
      }
      
      allEarnedCards = earnedData.map(c => c.card_name);
      if (earnedData.length > 0) {
        lastOrderId = earnedData[0].order_id; // Get the most recent order ID for PB cash
      }
    }
    
    // 3. Calculate *total unique* cards
    uniqueEarnedCards = [...new Set(allEarnedCards)];
    const uniqueCardCount = uniqueEarnedCards.length;
    mainTier = getTierFromCount(uniqueCardCount);
    
    console.log(`User has ${uniqueCardCount} total unique cards. Tier: ${mainTier}`);

    // 4. Render all UI components
    renderCardSlider(uniqueEarnedCards);
    renderRockSlider(uniqueCardCount); // Progress bar shows *total* tier
    setupGalleryModal();
    
    await Promise.all([
      renderRewardGrid(),
      renderLeaderboard(),
      setupPbCashModal()
    ]);

  } // end mainRedeem

  mainRedeem();

})();
