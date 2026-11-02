// Fixed price for ONE time doing each type of care task, in SGD.
// MUST match server/src/utils/servicePrices.js (the server's number is the one that is charged).
// Price of a booking = each task's price × times a day × number of days, added up.
// No vague 'other' type on purpose, so a cheap task can't be used for a big job.
export const SERVICE_PRICES = { feed: 8, walk: 20, groom: 12, medication: 15, clean: 15, play: 12 }

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