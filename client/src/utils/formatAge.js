export function formatAge(totalMonths) {
  if (totalMonths == null) {
    return ''
  }
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  const y = `${years} ${years === 1 ? 'year' : 'years'}`
  const m = `${months} ${months === 1 ? 'month' : 'months'}`
  if (years === 0) {
    return m
  }
  return months === 0 ? y : `${y} ${m}`
}