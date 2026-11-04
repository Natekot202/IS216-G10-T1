// The rules and the shape of a booking request, for the New Booking Request page (views/NewBookingRequest.vue).
// Two plain functions (no refs, no axios): the page gives them what the owner filled in and uses what they return.
// The server checks all of this again, so these exist only to tell the owner quickly, before anything is sent.
import { prettyDate } from './bookingTimeHelpers.js'

// `form` is { selectedPets, when, chosenDays, tasks, clash, unavailableDays }, taken from the page's refs:
//   selectedPets: array of pet ids        when: { startDate, endDate, dayTimes: [{ date, startTime, endTime }] }
//   chosenDays: every booked day          tasks: the care tasks
//   clash: true if the chosen time runs into a booked time
//   unavailableDays: chosen days the sitter hasn't marked as available
// Returns the message to show the owner, or '' if everything is fine.
export function checkBookingRequest({ selectedPets, when, chosenDays, tasks, clash, unavailableDays }) {
  if (selectedPets.length === 0) return 'Select at least one pet.'
  if (!when.startDate || !when.endDate) return 'Choose a start and end date.'
  if (when.endDate < when.startDate) return 'End date must be on or after the start date.'
  // Every day needs its hours, and each day's end must be after its start
  const missingDay = (when.dayTimes || []).find((d) => !d.startTime || !d.endTime)
  if (!when.dayTimes?.length || missingDay) {
    return missingDay ? `Choose a start time and an end time for ${prettyDate(missingDay.date)}.` : 'Choose a start time and an end time.'
  }
  const backwardsDay = when.dayTimes.find((d) => d.endTime <= d.startTime)
  if (backwardsDay) return `On ${prettyDate(backwardsDay.date)}, the end time must be after the start time.`
  if (clash) return 'The sitter is already booked during this time. Please choose different times.'
  if (unavailableDays.length) {
    return `The sitter is not available on ${unavailableDays.map(prettyDate).join(', ')}.`
  }

  if (tasks.length === 0) return 'Add at least one care task. The price is based on the tasks.'
  if (tasks.some((t) => !t.title.trim())) {
    return 'Give every care task a description, or remove it.'
  }
  if (tasks.some((t) => !Number.isInteger(t.dailyFrequency) || t.dailyFrequency < 1 || t.dailyFrequency > 10)) {
    return 'Times a day must be a whole number from 1 to 10.'
  }
  // .some returns true/false for the condition
  const noRoute = tasks.find((t) => t.category === 'walk' && !t.walkRouteId)
  if (noRoute) return `Choose a route for "${noRoute.title.trim()}", or pick "No route – follow my instructions".`
  const noDays = tasks.find((t) => t.someDays && !t.days.length)
  if (noDays) return `Choose the days for "${noDays.title.trim()}", or set it to every day.`
  const emptyDay = chosenDays.find((d) => !tasks.some((t) => !t.days.length || t.days.includes(d)))
  if (emptyDay) return `${prettyDate(emptyDay)} has no tasks. Add a task for that day, or remove the day.`
  return ''
}

// Builds the object that is sent to the server (POST /api/bookings). `notes` is the owner's note to the sitter.
export function buildBookingPayload(sitterId, { selectedPets, when, tasks, notes }) {
  return {
    sitterId,
    petIds: selectedPets,
    startDate: when.startDate,
    endDate: when.endDate,
    dayTimes: when.dayTimes, // the hours for each day: [{ date, startTime, endTime }]
    notes,
    tasks: tasks.map((t) => {
      // keep only pets that are still selected; if none are left, the task is for all selected pets
      const chosen = t.petIds.filter((id) => selectedPets.includes(id))
      return {
        category: t.category,
        title: t.title.trim(),
        dailyFrequency: t.dailyFrequency,
        petIds: chosen.length ? chosen : selectedPets,
        walkRouteId: t.walkRouteId, // walk tasks: a route's id, or 'instructions'
        days: t.days // empty = every day
      }
    })
  }
}
