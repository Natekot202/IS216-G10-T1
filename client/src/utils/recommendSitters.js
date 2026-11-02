// "Recommended for me" on the Search Sitters page (views/OwnerHome.vue): which sitters suit THIS owner, and why.
// Plain functions (no refs, no axios), so the rules live in one place.
//
// Baby example: Tom has a cat and a dog, and ticked "Grooming" under Services I need.
//   Sitter A takes Dog + Cat and offers Grooming   → shown, tags: "Takes Dog, Cat" "Offers Grooming"
//   Sitter B takes Dog only                        → hidden (can't look after the cat)
//   Sitter C takes Dog + Cat but only offers Feeding → hidden (doesn't offer what Tom needs)

// The pet types a sitter can tick in Edit Profile (same list as server/src/models/UserModel.js)
const PET_TYPES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Other']

// A pet's species is typed in freely ('dog', 'Shiba Inu'...), so turn it into one of the sitter's pet types:
// 'dog' → 'Dog', 'Shiba Inu' → 'Other' (anything that isn't on the list), '' → ''
export function petTypeOf(species) {
  const s = String(species || '').trim().toLowerCase()
  if (!s) return ''
  return PET_TYPES.find((t) => t.toLowerCase() === s) || 'Other'
}

// Why `sitter` suits this owner, or null if they don't.
//   needs:      the owner's "Services I need", e.g. ['Grooming']           ([] = skip this rule)
//   petSpecies: the species of the owner's pets, e.g. ['Dog', 'cat']      ([] = skip this rule)
// Returns { reasons: ['Takes Dog, Cat', 'Offers Grooming'], servicesMatched: 1 }
export function matchReasons(sitter, needs, petSpecies) {
  const takes = sitter.sitterProfile?.petTypes || []
  const offers = sitter.sitterProfile?.services || []

  // 1. Pets: the sitter must take EVERY kind of pet the owner has
  const types = [...new Set(petSpecies.map(petTypeOf).filter(Boolean))]
  if (types.length && !types.every((t) => takes.includes(t))) return null

  // 2. Services: the sitter must offer at least one thing the owner needs
  const matched = needs.filter((s) => offers.includes(s))
  if (needs.length && !matched.length) return null

  const reasons = []
  if (types.length) reasons.push(`Takes ${types.join(', ')}`)
  if (matched.length) reasons.push(`Offers ${matched.join(', ')}`)
  return { reasons, servicesMatched: matched.length }
}

// 3. Order: most services matched first, then the higher rating, then the closer sitter.
// Each item in `list` is a sitter with `match` (from matchReasons) and `distanceKm` (from the page).
export function sortByMatch(list) {
  return [...list].sort((a, b) =>
    b.match.servicesMatched - a.match.servicesMatched ||
    (b.sitterProfile?.ratingAvg || 0) - (a.sitterProfile?.ratingAvg || 0) ||
    (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
  )
}