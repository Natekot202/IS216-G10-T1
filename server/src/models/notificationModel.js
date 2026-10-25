import mongoose from 'mongoose'
const { ObjectId } = mongoose.Schema.Types

// The kinds of notification. Add more here as other features need them.
export const NOTIFICATION_TYPES = ['walk-off-route', 'walk-back-on-route', 'walk-ended-early']

// A message for one user, shown on their Notifications page
const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String, required: true, trim: true, maxlength: 300 },
    walk: { type: ObjectId, ref: 'Walk', default: null },   // the walk it's about, if any
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
)

const Notification = mongoose.model('Notification', notificationSchema, 'notifications')

export default Notification
