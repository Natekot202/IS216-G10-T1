import Notification from '../models/notificationModel.js'

const MAX_LISTED = 50   // the Notifications page shows the newest 50

// GET /api/notifications -> the logged-in user's newest notifications, newest first
export async function getMyNotifications(req, res) {
  const notifications = await Notification.find({ recipient: req.session.userId })
    .sort({ createdAt: -1 })
    .limit(MAX_LISTED)
  res.json(notifications)
}

// GET /api/notifications/unread-count -> { count } for the navbar badge
// (kept separate and small because the badge asks every 10 seconds)
export async function getUnreadCount(req, res) {
  const count = await Notification.countDocuments({ recipient: req.session.userId, read: false })
  res.json({ count })
}

// PATCH /api/notifications/:id/read -> marks one notification as read
export async function markRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.session.userId },   // only your own notifications
    { read: true },
    { new: true }
  )
  if (!notification) return res.status(404).json({ message: 'Notification not found' })
  res.json(notification)
}

// PATCH /api/notifications/read-all -> marks all of the user's notifications as read
export async function markAllRead(req, res) {
  await Notification.updateMany({ recipient: req.session.userId, read: false }, { read: true })
  res.json({ message: 'All notifications marked as read' })
}
