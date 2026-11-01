import mongoose from 'mongoose'

// The care checklist an owner attaches to a booking request:
// one document per booking, holding a list of tasks (feed, walk, medication...).
// Linked to the booking by `bookingId`, so Booking itself is not changed.
// The task fields use the same names as the task model in TaskModel.js
// (category, title, petIds, dailyFrequency) so the two can be merged later.
// Must match the keys in utils/servicePrices.js (each type has a fixed price). No vague 'other' type.
// (Old checklists saved with 'other' still load fine; they are never saved again.)
export const CATEGORIES = ['feed', 'walk', 'groom', 'medication', 'clean', 'play']

// GeoJSON line, the same shape as WalkRoute.path: [[lng, lat], ...]
const lineStringSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['LineString'], required: true },
    coordinates: { type: [[Number]], required: true }
  },
  { _id: false }
)

// Walk tasks only: the route the sitter should follow.
// 'route': a COPY of one of the owner's recorded routes, taken when the booking was made,
//          so editing or deleting the route later doesn't change this booking.
// 'instructions': no route; the sitter follows the task's written instructions
//          (the walk is still tracked, but can't be checked against a route).
const walkRouteSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['route', 'instructions'], required: true },
    route: { type: mongoose.Schema.Types.ObjectId, ref: 'WalkRoute', default: null }, // the original route
    name: { type: String, trim: true, default: '' },
    path: { type: lineStringSchema, default: undefined },
    distanceM: { type: Number, default: 0 }
  },
  { _id: false }
)

// Units a feed task's amount can be in
export const FOOD_UNITS = ['cup', 'g', 'scoop', 'can']

// The care details the owner adds after confirming the booking (all optional).
// They live in their own group so the owner can edit them without touching the task's
// category or times per day, which set the price.
// Every task: instructions, times. Feed tasks: food, amount, unit. Medication tasks: medicationName, dosage, withFood.
const careDetailsSchema = new mongoose.Schema(
  {
    instructions: { type: String, trim: true, maxlength: 1000 }, // e.g. "The leash is on the hook by the door"
    times: { type: [String], default: undefined }, // e.g. ['08:00', '18:00'], one for each time a day
    food: { type: String, trim: true, maxlength: 100 },
    amount: { type: Number, min: 0 },
    unit: { type: String, enum: FOOD_UNITS },
    medicationName: { type: String, trim: true, maxlength: 100 },
    dosage: { type: String, trim: true, maxlength: 100 }, // e.g. "1 tablet", "2.5 ml"
    withFood: { type: Boolean }
  },
  { _id: false }
)

const taskSchema = new mongoose.Schema({
  category: { type: String, enum: CATEGORIES, required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 }, // e.g. "Feed 1 cup kibble"
  petIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pet' }], // which pets the task is for
  dailyFrequency: { type: Number, required: true, min: 1, max: 10 }, // times per day
  days: { type: [String], default: undefined }, // 'YYYY-MM-DD' dates it's done on. Empty = every day of the booking
  walkRoute: { type: walkRouteSchema, default: undefined }, // walk tasks only
  details: { type: careDetailsSchema, default: undefined } // added after the booking is confirmed
})

const careChecklistSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    items: [taskSchema],
    // When the owner last saved the care details (null = not yet, so the booking still asks for them).
    // A date, not a check of the fields, because an owner may have nothing extra to add.
    detailsSavedAt: { type: Date, default: null }
  },
  { timestamps: true }
)
// because of this referencing, each checklist document contaisn the booking id its "attached " to 

// Is this task done on this date ('YYYY-MM-DD')? A task with no days of its own is done every day.
export const taskIsOn = (task, date) => !task.days?.length || task.days.includes(date)

export default mongoose.model('CareChecklist', careChecklistSchema, 'carechecklists')
