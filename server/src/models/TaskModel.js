const mongoose = require('mongoose')
const { Schema } = mongoose

// The allowed task types. Each one is registered as a discriminator below.
const CATEGORIES = ['feed', 'walk', 'groom', 'medication', 'other']

// Sitters only get the full task details once the booking has reached one of these statuses
// (i.e. the owner has paid). Before that they see the short version.
const FULL_DETAIL_STATUSES = ['paid', 'in-progress', 'completed']

// Fields a sitter must NOT see before then. Everything else on a task is the "short version".
const DETAIL_FIELDS = [
  'instructions',
  'ownerNote',
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
    // --- short version: filled in when the request is sent, visible to sitters ---
    category: { type: String, required: true, enum: CATEGORIES },
    title: { type: String, required: true, trim: true },
    petIds: [{ type: Schema.Types.ObjectId, ref: 'Pet' }],

    // "HH:mm" local times. times.length is the number of visits per day.
    times: {
      type: [{ type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ }],
      validate: [(v) => v.length > 0, 'A task needs at least one time']
    },

    // Empty = every day of the booking. Fill in only for one-off tasks (e.g. nail trim on one day).
    days: [Date],

    requiresPhoto: { type: Boolean, default: false },

    // --- full details: owner can add any time before check-in, hidden from sitters until paid ---
    instructions: { type: String, maxlength: 1000 },
    ownerNote: { type: String, maxlength: 200 },
    referencePhotos: [photoSchema]
  },
  { discriminatorKey: 'category' }
)

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
function stripDetails(items) {
  return items.map((item) => {
    const plain = typeof item.toObject === 'function' ? item.toObject() : { ...item }
    for (const field of DETAIL_FIELDS) delete plain[field]
    return plain
  })
}

module.exports = mongoose.model('Tasklist', tasklistSchema)
module.exports.CATEGORIES = CATEGORIES
module.exports.FULL_DETAIL_STATUSES = FULL_DETAIL_STATUSES
module.exports.DETAIL_FIELDS = DETAIL_FIELDS
module.exports.stripDetails = stripDetails
