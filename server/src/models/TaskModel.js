const mongoose = require('mongoose')
const { Schema } = mongoose

// The allowed task types. Each one is registered as a discriminator below.
export const CATEGORIES = ['feed', 'walk', 'groom', 'medication', 'other']

// Sitters only get the full task details once the booking has reached one of these statuses
// (i.e. the owner has paid). Before that they see the short version.
export const FULL_DETAIL_STATUSES = ['paid', 'in-progress', 'completed']

// Fields a sitter must NOT see before then. Everything else on a task is the "short version".
export const DETAIL_FIELDS = [
  'instructions',
  'referencePhotos',
  'medicationName',
  'dosage',
  'withFood'
]

// ---------- shared piece ----------

const photoSchema = new Schema(
  {
    url: { type: String, required: true }, // file lives in Cloudinary, we keep only the URL
    caption: { type: String, maxlength: 80 }
  },
  { _id: false }
)

// ---------- base task ----------
// This is the PLAN only. Whether a visit got done lives in TaskCompletion,
// and the end-of-job write-up lives in CareReport.
// 'category' is the discriminator key: it decides which extra fields a task has.
// The enum is needed, otherwise Mongoose silently accepts unknown categories.

const taskSchema = new Schema(
  {
    // --- task type ---
    category: {
      type: String,
      required: true,
      enum: CATEGORIES
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    petIds: {
      type: [{
        type: Schema.Types.ObjectId,
        ref: 'Pet',
        required: true
      }],
      validate: {
        validator: function (ids) {
          return Array.isArray(ids) && ids.length >= 1
        },
        message: 'A task must be assigned to at least one pet'
      }
    },

    // --- frequency ---
    // Number of times this task must be done per applicable day.
    dailyFrequency: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Daily frequency must be a whole number'
      }
    },

    // --- scheduling ---
    // Optional local times, e.g. ["08:00", "18:00"].
    // If omitted, the sitter chooses when to perform the task.
    times: {
      type: [{
        type: String,
        match: /^([01]\d|2[0-3]):[0-5]\d$/
      }],
      default: undefined,
      validate: {
        validator: function (times) {
          return (
            !times ||
            times.length === 0 ||
            times.length === this.dailyFrequency
          )
        },
        message:
          'Number of scheduled times must match daily frequency'
      }
    },

    // Empty = every day of the booking.
    // Otherwise, the task applies only on the specified dates.
    days: {
      type: [Date],
      default: []
    },

    requiresPhoto: {
      type: Boolean,
      default: false
    },

    // --- full details ---
    instructions: {
      type: String,
      maxlength: 1000
    },

    referencePhotos: [photoSchema]
  },
  { discriminatorKey: 'category' }
)

//---------- validation -----------
taskSchema.pre('validate', function () {
  if (
    this.times?.length > 0 &&
    this.times.length !== this.dailyFrequency
  ) {
    this.invalidate(
      'times',
      'Number of scheduled times must match daily frequency'
    )
  }
})

// ---------- tasklist (one per booking) ----------

const tasklistSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    items: [taskSchema]
  },
  { timestamps: true }
)

// ---------- category-specific fields ----------

const itemsPath = tasklistSchema.path('items')

itemsPath.discriminator(
  'feed',
  new Schema({
    food: { type: String, required: true }, // "kibble"
    amount: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ['cup', 'g', 'scoop', 'can'], default: 'cup' }
  })
)

itemsPath.discriminator(
  'walk',
  new Schema({
    distanceKm: { type: Number, min: 0 },
    durationMinutes: { type: Number, required: true, min: 5 }
  })
)

itemsPath.discriminator(
  'groom',
  new Schema({
    service: { type: String, required: true, enum: ['brush', 'nail-trim', 'teeth'] }
  })
)

// Medication name and dosage are full details, so they are optional at request time.
itemsPath.discriminator(
  'medication',
  new Schema({
    medicationName: { type: String },
    dosage: { type: String }, // "1 tablet", "2.5 ml"
    withFood: { type: Boolean, default: false }
  })
)

// Needs to be registered or Mongoose rejects category: 'other'
itemsPath.discriminator('other', new Schema({}))

// ---------- helper for the route ----------

// Returns a copy of the items without the detail fields (the sitter's short version).
export function stripDetails(items) {
  return items.map((item) => {
    const plain = typeof item.toObject === 'function' ? item.toObject() : { ...item }
    for (const field of DETAIL_FIELDS) delete plain[field]
    return plain
  })
}

export async function getPetNames(booking_id){
  try{
    await task.populate('petIds', 'name');
    
  }catch(error){
    console.log(error)
  }
}

const TaskList = mongoose.model('Tasklist', tasklistSchema)
export default TaskList
