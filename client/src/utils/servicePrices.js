// Fixed price for ONE time doing each type of care task, in SGD.
// MUST match server/src/utils/servicePrices.js (the server's number is the one that is charged).
// Price of a booking = each task's price × times a day × number of days, added up
//                      + the overnight fee for every night (if the owner asked for an overnight stay).
// No vague 'other' type on purpose, so a cheap task can't be used for a big job.
export const SERVICE_PRICES = { feed: 8, walk: 20, groom: 12, medication: 15, clean: 15, play: 12 }

// Overnight stay: the sitter sleeps at the owner's place. Same fixed fee for every sitter, per night.
export const OVERNIGHT_FEE = 60

// Nice names for the dropdown, e.g. 'walk' → 'Walk ($20)'
export const SERVICE_LABELS = { feed: 'Feed', walk: 'Walk', groom: 'Groom', medication: 'Medication', clean: 'Clean-up', play: 'Playtime' }

// One-line hint of what each type covers (shown under the dropdown)
export const SERVICE_HINTS = {
  feed: 'Food and fresh water',
  walk: 'About 30 minutes outside',
  groom: 'Brushing, wiping, a quick tidy-up',
  medication: 'Give medicine at the right dose and time',
  clean: 'Litter tray, cage or bowls',
  play: 'About 20-30 minutes of play and company'
}

// 'Feed $8 · Walk $20 · Groom $12 · Medication $15 · Clean-up $15 · Playtime $12' (for price notes on the pages)
export const PRICE_LIST_TEXT = Object.keys(SERVICE_PRICES)
  .map((c) => `${SERVICE_LABELS[c]} $${SERVICE_PRICES[c]}`)
  .join(' · ')

// tasks: [{ category, dailyFrequency }]   days: how many days the booking covers
export function priceForTasks(tasks, days) {
  let total = 0
  for (const task of tasks) {
    total += (SERVICE_PRICES[task.category] ?? 0) * (Number(task.dailyFrequency) || 0) * days
  }
  return Math.round(total * 100) / 100 // rounded to cents
}

// A 3-day booking (Mon, Tue, Wed) has 2 nights. No overnight stay = 0 nights.
export function nightsFor(days, overnight) {
  return overnight ? Math.max(days - 1, 0) : 0
}

// The whole booking price = care tasks + overnight fee for every night
export function bookingPrice(tasks, days, overnight) {
  return Math.round((priceForTasks(tasks, days) + OVERNIGHT_FEE * nightsFor(days, overnight)) * 100) / 100
}