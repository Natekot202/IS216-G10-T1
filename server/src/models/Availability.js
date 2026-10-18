import mongoose from 'mongoose'

// One Availability document = one sitter on one day.
// `date` is always stored as midnight Singapore time (UTC+8), e.g. the day
// 2026-10-20 is stored as 2026-10-19T16:00:00.000Z. Use the helpers below
// instead of `new Date('2026-10-20')`, which would give midnight UTC.
const availabilitySchema = new mongoose.Schema(
  {
    sitterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['available', 'blocked'],
      required: true
    }
  },
  { timestamps: true }
)

// A sitter can only have one status per day.
availabilitySchema.index({ sitterId: 1, date: 1 }, { unique: true })

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000

// 'YYYY-MM-DD' -> Date at midnight SGT. Returns null if the string is not a real date.
export function sgtMidnight(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const d = new Date(`${dateStr}T00:00:00+08:00`)
  if (isNaN(d) || toSgtDateString(d) !== dateStr) return null // rejects e.g. 2026-02-30
  return d
}

// Date -> 'YYYY-MM-DD' as seen on a calendar in Singapore.
export function toSgtDateString(date) {
  return new Date(new Date(date).getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10)
}

export default mongoose.model('Availability', availabilitySchema, 'availabilities')
