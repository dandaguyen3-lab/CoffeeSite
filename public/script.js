// Only allow redirects to another page on this site (stops ?next=https://evil.com).
function safeNext(raw) {
  const fallback = "landpage.html";
  if (!raw) return fallback;
  return /^[A-Za-z0-9_\-.%]+\.html(\?[A-Za-z0-9_\-.%=&]*)?$/.test(raw) ? raw : fallback;
}

function nextParam() {
  return new URLSearchParams(location.search).get("next");
}

async function login() {
  const username = document.getElementById("userinput").value;
  const password = document.getElementById("passwordinput").value;
  const result = document.getElementById("result");
  result.textContent = "";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      result.textContent = data.error || "Username or password is incorrect.";
      return;
    }
    localStorage.setItem("currentUser", JSON.stringify(data.user));
    window.location.href = safeNext(nextParam());
  } catch (err) {
    result.textContent = "Could not reach the shop. Check your connection and try again.";
  }
}

async function createAccount() {
  const username = document.getElementById("createusername").value.trim();
  const password = document.getElementById("createpassword").value;
  const email = document.getElementById("createemail").value.trim();
  const phone = document.getElementById("createphone").value.replace(/[\s\-().]/g, "");
  const result = document.getElementById("result");
  result.textContent = "";

  if (!username || !password || !email || !phone) {
    result.textContent = "Fill in your username, password, email and mobile number.";
    return;
  }
  // Philippine mobile numbers only: 09 + 9 more digits.
  if (!/^09\d{9}$/.test(phone)) {
    result.textContent = "Mobile number must start with 09 and have 11 digits, for example 09171234567.";
    return;
  }

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password, email, phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      result.textContent = data.error || "Could not create your account.";
      return;
    }
    // The server signs the new customer in, so carry on to wherever they were headed.
    localStorage.setItem("currentUser", JSON.stringify(data.user));
    window.location.href = safeNext(nextParam());
  } catch (err) {
    result.textContent = "Could not reach the shop. Check your connection and try again.";
  }
}

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "null");
    } catch (err) {
      return null;
    }
  }

  async function logoutCustomer() {
    await fetch("/api/logout", { method: "POST", credentials: "include" }).catch(() => {});
    localStorage.removeItem("currentUser");
    window.location.href = "landpage.html";
  }

    function enableSmartNavbarScroll() {
      let lastScrollTop = 0;
      const navbar = document.querySelector('.navbar');
      if (!navbar) return;

      window.addEventListener('scroll', function() {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        navbar.classList.toggle('scrolled', scrollTop > 12);

        if (scrollTop > lastScrollTop && scrollTop > 80) {
          navbar.style.transform = "translateY(-110%)";
        } else {
          navbar.style.transform = "translateY(0)";
        }

        lastScrollTop = scrollTop;
      });
    }

function moveSizeUnderline(option) {
  const underline = document.getElementById('underline');
  if (!underline || !option) return;
  const offset = option.offsetLeft + option.offsetWidth / 2 - underline.offsetWidth / 2;
  underline.style.transform = `translateX(${offset}px)`;
}

function sizes() {
  const options = document.querySelectorAll('.size-option');
  const underline = document.getElementById('underline');
  if (!options.length) return;

  options.forEach(option => {
    option.addEventListener('click', () => {
      options.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      moveSizeUnderline(option);
    });
  });

  const placeUnderline = () => {
    const selected = document.querySelector('.size-option.selected') ||
      document.querySelector('.size-option[data-size="Grande"]') ||
      options[0];
    if (selected && !document.querySelector('.size-option.selected')) {
      selected.classList.add('selected');
    }
    moveSizeUnderline(selected);
  };

  if (document.readyState === 'complete') {
    placeUnderline();
  } else {
    window.addEventListener("load", placeUnderline);
  }
  }
  
  const ids = [
    "title-name", "popular-title", "coffee1-title", "coffee1-desc", "coffee2-title", "coffee2-desc",
    "coffee3-title", "coffee3-desc", "coffee4-title", "coffee4-desc", "coffee5-title", "coffee5-desc",
    "coffee6-title", "coffee6-desc", "copyright-text"
  ];
  
  const imageIds = [
    "title-image", "coffee1-image", "coffee2-image", "coffee3-image",
    "coffee4-image", "coffee5-image", "coffee6-image"
  ];

  function readcontent() {
  // Populate text content
  ids.forEach(id => {
    const value = localStorage.getItem(id);
    const el = document.getElementById(id);
    if (value && el) {
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        el.value = value;
      } else {
        el.innerHTML = value;
      }
    }
  });

  // Populate images
  imageIds.forEach(imageId => {
    const imgData = localStorage.getItem(imageId);
    const imgElement = document.getElementById(imageId);
    if (imgData && imgElement) {
      imgElement.src = imgData;
    }
  });
}

function savecontent() {
  document.getElementById("cms-form").addEventListener("submit", function (e) {
    e.preventDefault();

    // Save text content
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        localStorage.setItem(id, el.value);
      }
    });

    // Save images
    imageIds.forEach(imageId => {
      const fileInput = document.getElementById(imageId + "-file");
      if (fileInput && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (event) {
          localStorage.setItem(imageId, event.target.result);
        };
        reader.readAsDataURL(fileInput.files[0]);
      }
    });

    alert("Changes saved! Open the Homepage to view them.");
  });
}

function revertImage(id, defaultSrc) {
  localStorage.removeItem(id); // Clear the saved custom image
  const img = document.getElementById(id);
  if (img) {
    img.src = defaultSrc; // Set the default image
  }
}
/*
function toggleMenu() {
  // Get the button and the menu items
  const toggleButton = document.getElementById('toggle-menu-btn');
  const menuItems = document.getElementById('menu-items');

  // Initially set the display to block (visible), or you can set this in CSS
  menuItems.style.display = 'block'; 

  // Add click event listener to the button
  toggleButton.addEventListener('click', function() {
      // Toggle between hiding and showing the menu items
      if (menuItems.style.display === 'none') {
          menuItems.style.display = 'block'; // Show menu
      } else {
          menuItems.style.display = 'none'; // Hide menu
      }
  });
}
*/
function toggleMenu() {
  document.querySelectorAll('.toggle-btn').forEach(button => {
    button.addEventListener('click', () => {
      const coffeeId = button.getAttribute('data-coffee');

      // Get current state from localStorage
      const isHidden = localStorage.getItem(coffeeId) === 'hidden';

      // Toggle state
      localStorage.setItem(coffeeId, isHidden ? 'visible' : 'hidden');
      alert(`${coffeeId} is now set to ${isHidden ? 'visible' : 'hidden'}`);
    });
  });
}

/*
=================================
COFFEE CART FUNCTIONALITY
=================================
This section contains all the JavaScript functions for the coffee cart system.

Main Functions:
1. addToCart - Adds coffee items to cart with customizations
2. calculatePrice - Determines price based on coffee size
3. displayCartItems - Renders cart items in the UI
4. updateQuantity - Handles quantity changes
5. removeFromCart - Removes items from cart
6. checkout - Processes the final order

Data Storage:
- Uses localStorage to persist cart data
- Stores customizations separately
- Maintains quantity and price information

Cart Features:
- Add/remove items
- Adjust quantities
- Apply customizations
- Calculate totals
- Process checkout
=================================
*/

/**
 * Adds a coffee item to the cart
 * @param {string} coffeeName - Name of the coffee
 * @param {string} size - Size of the coffee (Short, Tall, Grande, Venti)
 * @param {string} imagePath - Path to the coffee image
 */
function addToCart(coffeeName, size, imagePath) {
  // Browsing is open to everyone. Ordering needs an account.
  if (!getCurrentUser()) {
    localStorage.setItem('pendingAdd', JSON.stringify({
      name: coffeeName,
      size: size,
      image: imagePath,
      customizations: storedCustomizationsFor(coffeeName),
      savedAt: Date.now()
    }));
    showLoginGate();
    return;
  }
  if (commitAddToCart(coffeeName, size, imagePath)) {
    window.location.href = 'coffeecart.html';
  }
}

function commitAddToCart(coffeeName, size, imagePath, customizationsOverride) {
  let cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
  const maxDrinks = window.KOPI_PRICING.maxDrinksPerOrder;
  if (cartDrinkCount(cartItems) + 1 > maxDrinks) {
    showNotification('You can order up to ' + maxDrinks + ' drinks at a time. Check out your current order first.', 4000, 'warn');
    return false;
  }
  const customizations = customizationsOverride || storedCustomizationsFor(coffeeName);

  const existingItemIndex = cartItems.findIndex(item =>
    item.name === coffeeName &&
    item.size === size &&
    JSON.stringify(item.customizations || {}) === JSON.stringify(customizations)
  );

  if (existingItemIndex !== -1) {
    cartItems[existingItemIndex].quantity = (cartItems[existingItemIndex].quantity || 1) + 1;
  } else {
    cartItems.push({
      name: coffeeName,
      size: size,
      price: calculatePrice(size, customizations),
      quantity: 1,
      image: imagePath,
      customizations: customizations
    });
  }

  localStorage.removeItem('currentCustomizations');
  localStorage.removeItem('currentCustomizationsFor');
  localStorage.setItem('cartItems', JSON.stringify(cartItems));
  return true;
}

// After a customer signs in from the prompt, the drink they picked is added for them.
function applyPendingAdd() {
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem('pendingAdd') || 'null'); } catch (err) {}
  if (!pending) return false;
  localStorage.removeItem('pendingAdd');
  if (Date.now() - (pending.savedAt || 0) > 30 * 60 * 1000) return false;
  return commitAddToCart(pending.name, pending.size, pending.image, pending.customizations || {});
}

// Yes/No dialog. Resolves true for Yes, false for No / Escape / clicking outside.
function showConfirm({ title, text, lines = [], total, yes, no }) {
  return new Promise((resolve) => {
    const gate = document.createElement('div');
    gate.className = 'login-gate';
    gate.innerHTML = `
      <div class="gate-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title"></h2>
        <p class="confirm-text"></p>
        <ul class="confirm-list"></ul>
        <div class="confirm-total"><span>Total</span><strong></strong></div>
        <div class="gate-actions">
          <button type="button" class="gate-btn confirm-no"></button>
          <button type="button" class="gate-btn primary confirm-yes"></button>
        </div>
      </div>`;
    gate.querySelector('#confirm-title').textContent = title;
    gate.querySelector('.confirm-text').textContent = text;
    gate.querySelector('.confirm-total strong').textContent = total || '';
    const list = gate.querySelector('.confirm-list');
    lines.forEach((line) => {
      const li = document.createElement('li');
      const a = document.createElement('span'); a.textContent = line.text;
      const b = document.createElement('span'); b.textContent = line.price;
      li.append(a, b);
      list.appendChild(li);
    });
    const yesBtn = gate.querySelector('.confirm-yes');
    const noBtn = gate.querySelector('.confirm-no');
    yesBtn.textContent = yes;
    noBtn.textContent = no;

    const done = (answer) => {
      document.removeEventListener('keydown', onKey);
      gate.remove();
      resolve(answer);
    };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onKey);
    noBtn.onclick = () => done(false);
    yesBtn.onclick = () => { yesBtn.disabled = true; done(true); }; // one click only, no double orders
    gate.addEventListener('click', (e) => { if (e.target === gate) done(false); });
    document.body.appendChild(gate);
    noBtn.focus(); // Enter alone never places the order
  });
}

function showLoginGate() {
  if (document.getElementById('login-gate')) return;
  const next = encodeURIComponent('coffeecart.html');
  const gate = document.createElement('div');
  gate.id = 'login-gate';
  gate.className = 'login-gate';
  gate.innerHTML = `
    <div class="gate-card" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <h2 id="gate-title">Log in to place your order</h2>
      <p>You can browse the whole menu without an account. We just need to know who the order is for, so the kitchen can call your name. Your drink will be waiting in your cart.</p>
      <div class="gate-actions">
        <a class="gate-btn primary" href="login.html?next=${next}">Log in</a>
        <a class="gate-btn" href="createaccount.html?next=${next}">Create account</a>
      </div>
      <button type="button" class="gate-close">Keep browsing</button>
    </div>`;
  document.body.appendChild(gate);

  const close = () => {
    localStorage.removeItem('pendingAdd');
    gate.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  gate.querySelector('.gate-close').onclick = close;
  gate.addEventListener('click', (e) => { if (e.target === gate) close(); });
  gate.querySelector('.gate-btn.primary').focus();
}

/**
 * Calculates the price of a coffee based on its size
 * @param {string} size - Size of the coffee
 * @returns {number} Price of the coffee
 */
function calculatePrice(size, customizations) {
  // Prices come from pricing.js, the same file the server uses.
  return window.KOPI_PRICING.unitPrice(size, customizations || {});
}

// Drink pages: once the cart holds the maximum number of drinks, Add to order is locked.
function refreshAddButton() {
  const btn = document.querySelector('.sizes .addtoorderbtn, .sizes .button-container.right .coffee-button');
  if (!btn || !window.KOPI_PRICING) return;
  const max = window.KOPI_PRICING.maxDrinksPerOrder;
  if (btn.dataset.label === undefined) btn.dataset.label = btn.innerHTML;
  if (cartDrinkCount() >= max) {
    btn.disabled = true;
    btn.innerHTML = '<b>CART FULL (' + max + '/' + max + ')</b>';
    btn.title = 'You already have ' + max + ' drinks in your cart. Check out first.';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.label;
    btn.removeAttribute('title');
  }
}
window.addEventListener('pageshow', refreshAddButton);

function cartDrinkCount(items) {
  const list = items || JSON.parse(localStorage.getItem('cartItems')) || [];
  return list.reduce((sum, item) => sum + (item.quantity || 1), 0);
}

// Extras chosen on the customize page belong to the drink they were chosen for.
function storedCustomizationsFor(coffeeName) {
  if (localStorage.getItem('currentCustomizationsFor') !== coffeeName) return {};
  try { return JSON.parse(localStorage.getItem('currentCustomizations')) || {}; } catch (err) { return {}; }
}

/**
 * Displays all items currently in the cart
 * Uses the cart item template to create visual elements
 */
function displayCartItems() {
  const cartContainer = document.getElementById('cart-container');
  if (!cartContainer) return;

  const cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
  
  if (cartItems.length === 0) {
    cartContainer.innerHTML = '<div class="empty-cart"><p>Your cart is empty</p><a class="coffee-button" href="menu.html">Browse the menu</a></div>';
    return;
  }

  // Clear existing items
  cartContainer.innerHTML = '<div class="cart-items"></div>';
  const cartItemsContainer = cartContainer.querySelector('.cart-items');
  
  const P = window.KOPI_PRICING;
  const totalDrinks = cartDrinkCount(cartItems);
  let totalCents = 0;
  
  cartItems.forEach((item, index) => {
    // Always priced from the current price list (size + extra charges)
    const unit = calculatePrice(item.size, item.customizations);
    const itemTotal = unit * (item.quantity || 1);
    totalCents += Math.round(unit * 100) * (item.quantity || 1);

    // Get the template
    const template = document.getElementById('cart-item-template');
    const cartItem = template.content.cloneNode(true);
    
    // Set the image
    const img = cartItem.querySelector('.coffee-image img');
    img.src = item.image || 'Assets/Coffee templates/Americano no bg.png';
    img.alt = item.name;
    
    // Set the name and size
    cartItem.querySelector('.coffee-name').textContent = `${item.name} (${item.size})`;
    
    // Set customizations if any
    if (item.customizations && Object.keys(item.customizations).length > 0) {
      const customizationsDiv = cartItem.querySelector('.customizations');
      for (const [option, quantity] of Object.entries(item.customizations)) {
        const span = document.createElement('span');
        span.textContent = `${quantity}x ${(P.extras[option] && P.extras[option].label) || option}`;
        customizationsDiv.appendChild(span);
      }
      const charge = P.extrasCost(item.customizations);
      if (charge > 0) {
        const note = document.createElement('span');
        note.className = 'extras-charge';
        note.textContent = `+$${charge.toFixed(2)} extras per drink`;
        customizationsDiv.appendChild(note);
      }
    }
    
    // Set quantity
    cartItem.querySelector('.quantity-num').textContent = `x${item.quantity || 1}`;
    
    // Set price
    cartItem.querySelector('.item-price').textContent = `$${itemTotal.toFixed(2)}`;
    
    // Add event listeners
    const decreaseBtn = cartItem.querySelector('.quantity-btn.decrease');
    const increaseBtn = cartItem.querySelector('.quantity-btn.increase');
    const removeBtn = cartItem.querySelector('.remove-btn');
    
    decreaseBtn.onclick = () => updateQuantity(index, -1);
    increaseBtn.onclick = () => updateQuantity(index, 1);
    if (totalDrinks >= P.maxDrinksPerOrder) {
      increaseBtn.disabled = true;
      increaseBtn.title = 'Maximum of ' + P.maxDrinksPerOrder + ' drinks per order';
    }
    removeBtn.onclick = () => removeFromCart(index);
    
    // Add to container
    cartItemsContainer.appendChild(cartItem);
  });

  // Add total and checkout button
  const totalDiv = document.createElement('div');
  totalDiv.className = 'cart-total';
  const total = totalCents / 100;
  totalDiv.innerHTML = `
    <small class="drink-count">${totalDrinks} of ${P.maxDrinksPerOrder} drinks</small>
    <strong>Total: $${total.toFixed(2)}</strong>
    <button onclick="checkout()" class="checkout-btn">${getCurrentUser() ? 'Proceed to Checkout' : 'Log in to check out'}</button>
  `;
  cartContainer.appendChild(totalDiv);
}

/**
 * Updates the quantity of an item in the cart
 * @param {number} index - Index of the item in the cart array
 * @param {number} change - Amount to change the quantity by (+1 or -1)
 */
function updateQuantity(index, change) {
  let cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
  if (cartItems[index]) {
    const max = window.KOPI_PRICING.maxDrinksPerOrder;
    if (change > 0 && cartDrinkCount(cartItems) >= max) {
      showNotification('You can order up to ' + max + ' drinks at a time.', 3500, 'warn');
      return;
    }
    cartItems[index].quantity = Math.max(1, (cartItems[index].quantity || 1) + change);
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
    displayCartItems();
  }
}

/**
 * Removes an item from the cart
 * @param {number} index - Index of the item to remove
 */
function removeFromCart(index) {
  let cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
  cartItems.splice(index, 1);
  localStorage.setItem('cartItems', JSON.stringify(cartItems));
  displayCartItems();
}

/**
 * Shows a notification message
 * @param {string} message - The message to display
 * @param {number} duration - How long to show the notification in milliseconds
 */
function showNotification(message, duration = 3000, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification' + (type === 'warn' ? ' warn' : '');
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'warn' ? '!' : '✓'}</span>
            <span class="notification-message"></span>
        </div>
    `;
    notification.querySelector('.notification-message').textContent = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Remove notification after duration
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

/**
 * Processes the checkout and clears the cart
 */
async function checkout() {
    const user = getCurrentUser();
    if (!user) {
        showNotification("Log in so we know whose order this is.");
        setTimeout(() => {
            window.location.href = "login.html?next=coffeecart.html";
        }, 900);
        return;
    }

    const cartItems = JSON.parse(localStorage.getItem("cartItems")) || [];
    if (!cartItems.length) {
        showNotification("Your cart is empty.");
        return;
    }

    // "Are you really finished?" check before anything is sent to the kitchen.
    const P = window.KOPI_PRICING;
    const drinks = cartDrinkCount(cartItems);
    if (drinks > P.maxDrinksPerOrder) {
        showNotification("You can order up to " + P.maxDrinksPerOrder + " drinks at a time.", 3500, "warn");
        return;
    }
    const totalCents = cartItems.reduce(
        (sum, i) => sum + Math.round(calculatePrice(i.size, i.customizations) * 100) * (i.quantity || 1), 0);
    const lines = cartItems.map(i => ({
        text: (i.quantity || 1) + " × " + i.name + " (" + i.size + ")",
        price: "$" + ((Math.round(calculatePrice(i.size, i.customizations) * 100) * (i.quantity || 1)) / 100).toFixed(2),
    }));
    const confirmed = await showConfirm({
        title: "Are you finished ordering?",
        text: "Once you place the order it goes straight to the kitchen and can't be changed here.",
        lines,
        total: "$" + (totalCents / 100).toFixed(2),
        yes: "Yes, place order",
        no: "No, keep ordering",
    });
    if (!confirmed) return;

    try {
        const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ items: cartItems }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
            showNotification("Log in so we know whose order this is.");
            setTimeout(() => {
                window.location.href = "login.html?next=coffeecart.html";
            }, 900);
            return;
        }
        if (!res.ok) {
            showNotification(data.error || "Could not place the order.");
            return;
        }

        showNotification("Order " + data.order.number + " sent to the kitchen!");
        localStorage.removeItem("cartItems");
        displayCartItems();
        // Straight to the e-receipt, which can be downloaded as a PDF.
        setTimeout(() => {
            window.location.href = "receipt.html?order=" + encodeURIComponent(data.order.id);
        }, 900);
    } catch (err) {
        showNotification("Start the shop server to send live orders.");
    }
}

function getCartCount() {
  const items = JSON.parse(localStorage.getItem('cartItems') || '[]');
  return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
}

function enhanceNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  if (!navbar.querySelector('.brand')) {
    const brand = document.createElement('a');
    brand.className = 'brand';
    brand.href = 'landpage.html';
    brand.innerHTML = '<span>Kopi Ko</span><small>Kopi Mo</small>';
    navbar.insertBefore(brand, navbar.firstChild);
  }

  const cartAnchor = Array.from(navbar.querySelectorAll('a')).find(link =>
    (link.getAttribute('href') || '').includes('coffeecart.html')
  );
  if (cartAnchor) {
    cartAnchor.classList.add('cart-link');
    let badge = cartAnchor.querySelector('.cart-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cart-badge';
      cartAnchor.appendChild(badge);
    }
    const count = getCartCount();
    badge.textContent = String(count);
    badge.classList.toggle('is-empty', count === 0);
  }

  const path = (location.pathname.split('/').pop() || 'landpage.html').toLowerCase();
  navbar.querySelectorAll('a').forEach(link => {
    const href = (link.getAttribute('href') || '').toLowerCase();
    if (href && href === path) {
      link.classList.add('active');
    }
  });

  let account = navbar.querySelector(".account-links");
  if (!account) {
    account = document.createElement("div");
    account.className = "account-links";
    navbar.appendChild(account);
  }
  const user = getCurrentUser();
  account.textContent = "";
  if (user) {
    const name = document.createElement("span");
    name.className = "signed-in";
    name.textContent = user.username;
    const out = document.createElement("button");
    out.type = "button";
    out.className = "text-link";
    out.textContent = "Log out";
    out.onclick = logoutCustomer;
    const mine = document.createElement("a");
    mine.href = "orders.html";
    mine.textContent = "My orders";
    account.append(mine, name, out);
  } else {
    const loginLink = document.createElement("a");
    loginLink.href = "login.html";
    loginLink.textContent = "Login";
    const signup = document.createElement("a");
    signup.href = "createaccount.html";
    signup.textContent = "Sign up";
    account.append(loginLink, signup);
  }

  // Landing page: show different calls to action to guests and signed-in customers.
  document.querySelectorAll("[data-guest]").forEach(el => { el.hidden = Boolean(user); });
  document.querySelectorAll("[data-member]").forEach(el => { el.hidden = !user; });
  document.querySelectorAll("[data-username]").forEach(el => { el.textContent = user ? user.username : ""; });
}

async function bootUI() {
  if (!document.querySelector('meta[name="viewport"]')) {
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    document.head.appendChild(viewport);
  }

  try {
    const res = await fetch("/api/me", { credentials: "include" });
    if (res.ok) {
      localStorage.setItem("currentUser", JSON.stringify(await res.json()));
    } else if (res.status === 401) {
      localStorage.removeItem("currentUser");
    }
  } catch (err) {}

  // Keep ?next= when moving between the login and sign-up pages.
  document.querySelectorAll('.linkcreate').forEach(link => {
    if (location.search) link.href = link.getAttribute('href').split('?')[0] + location.search;
  });

  const onCartPage = Boolean(document.getElementById('cart-container'));
  if (onCartPage && getCurrentUser()) applyPendingAdd();

  enhanceNavbar();
  if (onCartPage) displayCartItems();
  refreshAddButton();
  if (document.querySelector('.navbar')) {
    enableSmartNavbarScroll();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootUI);
} else {
  bootUI();
}
