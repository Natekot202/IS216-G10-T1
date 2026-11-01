import mongoose from 'mongoose'

export const MAX_MESSAGE_LENGTH = 500

// One chat message between a booking's owner and sitter, shown in the chat on the Session page.
// Linked to the booking by `booking`, so Booking itself is not changed (same idea as CareChecklist.js).
const messageSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: MAX_MESSAGE_LENGTH }
  },
  { timestamps: true }
)

// Every read asks for one booking's messages in time order
messageSchema.index({ booking: 1, createdAt: 1 })

const Message = mongoose.model('Message', messageSchema, 'messages')

export default Message
