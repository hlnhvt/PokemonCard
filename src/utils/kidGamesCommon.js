// Helpers shared by the kids games (cooking, shop).

/** Customers are well-known Pokemon, different from the child's helper. */
export function pickCustomers(pool, count, excludeName, random) {
  const choices = pool.filter((p) => p.name.toLowerCase() !== String(excludeName || '').toLowerCase());
  const picked = [];
  const copy = [...choices];
  for (let i = 0; i < count; i++) {
    if (copy.length === 0) copy.push(...choices);
    picked.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  }
  return picked;
}
