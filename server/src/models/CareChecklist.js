import mongoose from 'mongoose'

// The care checklist an owner attaches to a booking request:
// one document per booking, holding a list of tasks (feed, walk, medication...).
// Linked to the booking by `bookingId`, so Booking itself is not changed.
// The task fields use the same names as the task model in TaskModel.js
// (category, title, petIds, dailyFrequency) so the two can be merged later.
export const CATEGORIES = ['feed', 'walk', 'groom', 'medication', 'other']

const taskSchema = new mongoose.Schema({
  category: { type: String, enum: CATEGORIES, required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 }, // e.g. "Feed 1 cup kibble"
  petIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pet' }], // which pets the task is for
  dailyFrequency: { type: Number, required: true, min: 1, max: 10 } // times per day
})

const careChecklistSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    items: [taskSchema]
  },
  { timestamps: true }
)
// because of this referencing, each checklist document contaisn the booking id its "attached " to 

export default mongoose.model('CareChecklist', careChecklistSchema, 'carechecklists')
