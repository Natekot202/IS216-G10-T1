import mongoose from 'mongoose'

// Remembers which Google Calendar event belongs to which booking (one per booking),
// so a booking is never added twice and the sitter can see what failed.
// Linked to the booking by `bookingId`, so the Booking model itself is not changed.
const calendarEventSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    sitterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    googleEventId: { type: String },
    status: { type: String, enum: ['synced', 'failed'], required: true },
    lastError: { type: String, default: '' }
  },
  { timestamps: true }
)

export default mongoose.model('CalendarEvent', calendarEventSchema, 'calendarevents')
