import Notification from '../models/notificationModel.js'

// Creates a notification for one user.
// If saving fails, the error is logged but not thrown: a failed notification
// shouldn't stop the action that triggered it (e.g. recording a deviation).
export async function notify(recipient, type, message, walk = null) {
  try {
    await Notification.create({ recipient, type, message, walk })
  } catch (err) {
    console.error('Could not create notification:', err.message)
  }
}
