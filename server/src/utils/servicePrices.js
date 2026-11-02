// Fixed price for ONE time doing each type of care task, in SGD.
// Every sitter charges the same (no hourly rate), so owners compare sitters on reviews, distance and services.
// The same list is in client/src/utils/servicePrices.js, so keep the two the same.
// There is NO "other" type on purpose: a vague cheap "other" task could be used for big jobs.
// Every task must be one of these 6 clear types:
//   walk $20        – the longest task (about 30 minutes out with the dog)
//   medication $15  – quick, but the sitter must get the dose and timing exactly right
//   clean $15       – litter tray, cage or bowls (a messy, unpleasant job)
//   groom $12       – brushing / wiping / a quick tidy-up at home (about 15-20 minutes)
//   play $12        – playtime / company at home (about 20-30 minutes)
//   feed $8         – quick (about 5-10 minutes), includes topping up water
export const SERVICE_PRICES = {
  feed: 8,
  walk: 20,
  groom: 12,
  medication: 15,
  clean: 15,
  play: 12
}

// Price of a booking = for every task: price × times a day × number of days, all added up.
// e.g. walk ($20) × 2 a day × 3 days = $120
// A task with its own `days` only counts those days: a nail clip on the last day of a week counts once.
export function priceForTasks(tasks, days) {
  let total = 0
  for (const task of tasks) {
    total += (SERVICE_PRICES[task.category] ?? 0) * task.dailyFrequency * (task.days?.length || days)
  }
  return Math.round(total * 100) / 100 // rounded to cents
}