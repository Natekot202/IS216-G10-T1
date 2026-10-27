import mongoose from 'mongoose'
import Review from '../models/reviewModel.js'
import User from '../models/UserModel.js'

export async function recalcSitterRating(sitterId) {
  const [stats] = await Review.aggregate([
    { $match: 
        { sitter: new mongoose.Types.ObjectId(String(sitterId)) } 
    },   
    { $group: 
        { _id: '$sitter', avg: { $avg: '$rating' }, count: { $sum: 1 } 
    } 
    }
  ])

  await User.findByIdAndUpdate(sitterId, {
    'sitterProfile.ratingAvg': stats ? Math.round(stats.avg * 10) / 10 : 0,
    'sitterProfile.ratingCount': stats ? stats.count : 0
  })
}

export async function recalcAllRatings() {
  const stats = await Review.aggregate([
    { $group: { _id: '$sitter', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ])

  const ops = stats.map((s) => ({
    updateOne: {
      filter: { _id: s._id },
      update: {
        $set: {
          'sitterProfile.ratingAvg': Math.round(s.avg * 10) / 10,
          'sitterProfile.ratingCount': s.count
        }
      }
    }
  }))

  ops.push({
    updateMany: {
      filter: { role: 'sitter', _id: { $nin: stats.map((s) => s._id) } },
      update: { $set: { 'sitterProfile.ratingAvg': 0, 'sitterProfile.ratingCount': 0 } }
    }
  })

  await User.bulkWrite(ops)
}

export function watchReviews() {
  let timer = null
  try {
    const stream = Review.watch()
    stream.on('change', () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        recalcAllRatings().catch((err) => console.error('Rating recalculation failed', err))
      }, 500)                               
    })
    stream.on('error', (err) => {
      console.warn('Review watcher stopped:', err.message)
    })
  } catch (err) {
    console.warn('Could not start the review watcher:', err.message)
  }
}