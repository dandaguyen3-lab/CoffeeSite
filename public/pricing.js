// Prices and order limits. This one file is used by the browser (cart, customize page)
// AND by server.js, so the two can never disagree. The server is the final judge.
//
// To change a price or a limit, edit it here and nowhere else.
(function (root) {
  const PRICING = {
    // Drink prices by size
    sizes: { Short: 2.99, Tall: 3.49, Grande: 4.99, Venti: 5.49 },

    // Most drinks one customer can put in a single order
    maxDrinksPerOrder: 10,

    // Extras (sweeteners and add-ins), priced per extra portion.
    // The first `freePerExtra` portions of each extra are free; up to `maxPerExtra` are allowed.
    freePerExtra: 3,
    maxPerExtra: 5,
    extras: {
      sugar:   { label: "Sugar",         price: 0.2 },
      honey:   { label: "Honey",         price: 0.35 },
      stevia:  { label: "Stevia",        price: 0.25 },
      cream:   { label: "Cream",         price: 0.4 },
      milk:    { label: "Milk",          price: 0.4 },
      vanilla: { label: "Vanilla Syrup", price: 0.5 },
    },
  };

  const cents = (n) => Math.round(n * 100);

  // Extra charge for ONE drink, e.g. 5 sugar = (5 - 3) x $0.20 = $0.40
  PRICING.extrasCost = function (customizations) {
    let total = 0;
    for (const [key, qty] of Object.entries(customizations || {})) {
      const extra = PRICING.extras[key];
      if (!extra) continue;
      const n = Math.min(Math.max(0, Math.floor(Number(qty) || 0)), PRICING.maxPerExtra);
      total += Math.max(0, n - PRICING.freePerExtra) * cents(extra.price);
    }
    return total / 100;
  };

  // Price of ONE drink: size price + extra charges
  PRICING.unitPrice = function (size, customizations) {
    const base = PRICING.sizes[size];
    if (base === undefined) return 0;
    return (cents(base) + cents(PRICING.extrasCost(customizations))) / 100;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = PRICING;
  else root.KOPI_PRICING = PRICING;
})(typeof window !== "undefined" ? window : globalThis);
