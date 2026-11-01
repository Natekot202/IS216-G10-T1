// Turns a task's care details into short text, for the Booking Detail page and the Session checklist.

// "1.5 scoops of kibble"
export function feedText(task) {
  if (task.category !== 'feed') return ''
  const { amount, unit, food } = task.details ?? {}
  const hasAmount = amount !== undefined && amount !== null
  const size = hasAmount ? `${amount} ${unit ?? ''}${amount > 1 && unit !== 'g' ? 's' : ''}`.trim() : ''
  return size && food ? `${size} of ${food}` : size || food || ''
}

// "Heartworm chewable, 1 tablet, with food"
export function medicationText(task) {
  if (task.category !== 'medication') return ''
  const { medicationName, dosage, withFood } = task.details ?? {}
  return [medicationName, dosage, withFood ? 'with food' : ''].filter(Boolean).join(', ')
}

// A medication task without its name or dosage: the sitter must not guess these
export function medicationIncomplete(task) {
  return task.category === 'medication' && !(task.details?.medicationName && task.details?.dosage)
}

// Has the owner added anything to this task? (a "with food" box left unticked doesn't count)
export function hasDetails(task) {
  const d = task.details ?? {}
  return Boolean(d.instructions || d.times?.length || d.referencePhotos?.length || feedText(task) || medicationText(task))
}
