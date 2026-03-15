/**
 * Optimizes flower pricing by combining items with the same price tier
 * and bin-packing weights into the best tier quantities (greedy, largest-first).
 *
 * @param {Array} items - Cart/order items (all product types)
 * @param {Object} priceTierMap - Map of tierId -> { prices: [{ quantity, price }] }
 * @returns {{ optimizedTotal: number, categorySubtotals: Object, flowerDiscount: number, originalFlowerTotal: number }}
 */
export const optimizeFlowerPricing = (items, priceTierMap) => {
  const flowerItems = items.filter((i) => i.productType === 'flower' && !i.unavailable);
  const otherItems = items.filter((i) => i.productType !== 'flower' && !i.unavailable);

  // Original flower total (pre-optimization)
  const originalFlowerTotal = flowerItems.reduce(
    (sum, item) => sum + (parseFloat(item.priceEach) || 0) * (item.quantity || 1),
    0
  );

  // Group flower items by priceTierId
  const tierGroups = {};
  for (const item of flowerItems) {
    const tierId = item.priceTierId;
    if (!tierId) continue;
    if (!tierGroups[tierId]) tierGroups[tierId] = [];
    tierGroups[tierId].push(item);
  }

  let optimizedFlowerTotal = 0;

  for (const [tierId, groupItems] of Object.entries(tierGroups)) {
    const tier = priceTierMap[tierId];
    if (!tier || !tier.prices || tier.prices.length === 0) {
      // No tier data available — fall back to original prices
      optimizedFlowerTotal += groupItems.reduce(
        (sum, item) => sum + (parseFloat(item.priceEach) || 0) * (item.quantity || 1),
        0
      );
      continue;
    }

    // Total grams in this tier group
    const totalGrams = groupItems.reduce((sum, item) => {
      const grams = parseFloat(item.weight) || 0;
      return sum + grams * (item.quantity || 1);
    }, 0);

    // Get sorted tier prices (largest quantity first for greedy packing)
    const sortedPrices = [...tier.prices].sort((a, b) => b.quantity - a.quantity);

    // Greedy bin-pack
    let remaining = totalGrams;
    let cost = 0;

    while (remaining > 0.01) {
      // Find the largest tier that fits
      const fitTier = sortedPrices.find((p) => p.quantity <= remaining + 0.01);
      if (fitTier) {
        cost += fitTier.price;
        remaining -= fitTier.quantity;
      } else {
        // Remaining is less than the smallest tier — use smallest tier price
        const smallest = sortedPrices[sortedPrices.length - 1];
        cost += smallest.price;
        remaining = 0;
      }
    }

    optimizedFlowerTotal += cost;
  }

  // Handle flower items without priceTierId (shouldn't happen but be safe)
  const noTierFlowers = flowerItems.filter((i) => !i.priceTierId);
  optimizedFlowerTotal += noTierFlowers.reduce(
    (sum, item) => sum + (parseFloat(item.priceEach) || 0) * (item.quantity || 1),
    0
  );

  // Other category totals
  const otherCategoryTotals = {};
  for (const item of otherItems) {
    const cat = item.productType || 'other';
    if (!otherCategoryTotals[cat]) otherCategoryTotals[cat] = 0;
    otherCategoryTotals[cat] += (parseFloat(item.priceEach) || 0) * (item.quantity || 1);
  }

  const categorySubtotals = {};
  if (flowerItems.length > 0) {
    categorySubtotals.flower = optimizedFlowerTotal;
  }
  Object.assign(categorySubtotals, otherCategoryTotals);

  const otherTotal = Object.values(otherCategoryTotals).reduce((s, v) => s + v, 0);

  return {
    optimizedTotal: optimizedFlowerTotal + otherTotal,
    categorySubtotals,
    flowerDiscount: originalFlowerTotal - optimizedFlowerTotal,
    originalFlowerTotal,
  };
};

/**
 * Extract priceTierMap from the products data returned by getAllProducts.
 * @param {Object} productsData - { flowers: [...] }
 * @returns {Object} Map of tierId -> { prices: [...] }
 */
export const buildPriceTierMap = (flowers = []) => {
  const map = {};
  for (const flower of flowers) {
    const tier = flower.priceTier;
    if (tier && tier._id) {
      map[tier._id] = tier;
    }
  }
  return map;
};
