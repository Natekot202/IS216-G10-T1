import mongoose from 'mongoose'
import Review from '../models/Review.js'
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