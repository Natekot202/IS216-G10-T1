// The rules and the shape of a booking request, for the New Booking Request page (views/NewBookingRequest.vue).
// Two plain functions (no refs, no axios): the page gives them what the owner filled in and uses what they return.
// The server checks all of this again, so these exist only to tell the owner quickly, before anything is sent.
import { prettyDate } from './bookingTimeHelpers.js'

// `form` is { selectedPets, when, tasks, clash, unavailableDays }, taken from the page's refs:
//   selectedPets: array of pet ids        when: { startDate, startTime, endDate, endTime }
//   tasks: the care tasks                 clash: true if the chosen time runs into a booked time
//   unavailableDays: chosen days the sitter hasn't marked as available
// Returns the message to show the owner, or '' if everything is fine.
export function checkBookingRequest({ selectedPets, when, tasks, clash, unavailableDays }) {
  if (selectedPets.length === 0) return 'Select at least one pet.'
  if (!when.startDate || !when.endDate) return 'Choose a start and end date.'
  if (when.endDate < when.startDate) return 'End date must be on or after the start date.'
  if (!when.startTime || !when.endTime) return 'Choose a start time and an end time.'
  if (clash) return 'The sitter is already booked during this time. Please choose different times.'
  if (unavailableDays.length) {
    return `The sitter is not available on ${unavailableDays.map(prettyDate).join(', ')}.`
  }

  if (tasks.some((t) => !t.title.trim())) {
    return 'Give every care task a description, or remove it.'
  }
  if (tasks.some((t) => !Number.isInteger(t.dailyFrequency) || t.dailyFrequency < 1 || t.dailyFrequency > 10)) {
    return 'Times a day must be a whole number from 1 to 10.'
  }
  // .some returns true/false for the condition 
  return ''
}

// Builds the object that is sent to the server (POST /api/bookings). `notes` is the owner's note to the sitter.
export function buildBookingPayload(sitterId, { selectedPets, when, tasks, notes }) {
  return {
    sitterId,
    petIds: selectedPets,
    startDate: when.startDate,
    startTime: when.startTime,
    endDate: when.endDate,
    endTime: when.endTime,
    notes,
    tasks: tasks.map((t) => {
      // keep only pets that are still selected; if none are left, the task is for all selected pets
      const chosen = t.petIds.filter((id) => selectedPets.includes(id))
      return {
        category: t.category,
        title: t.title.trim(),
        dailyFrequency: t.dailyFrequency,
        petIds: chosen.length ? chosen : selectedPets
      }
    })
  }
}
