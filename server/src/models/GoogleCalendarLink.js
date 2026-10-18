import mongoose from 'mongoose'

// A sitter's connection to their Google Calendar: one document per sitter.
// `refreshToken` is Google's long-lived permission to add events for them.
// It is like a password: it is never sent to the browser.
const googleCalendarLinkSchema = new mongoose.Schema(
  {
    sitterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    refreshToken: { type: String, required: true },
    needsReconnect: { type: Boolean, default: false } // true when Google says the permission is no longer valid
  },
  { timestamps: true }
)

export default mongoose.model('GoogleCalendarLink', googleCalendarLinkSchema, 'googlecalendarlinks')
