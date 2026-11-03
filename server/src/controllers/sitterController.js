import User from '../models/UserModel.js'
import Availability, { sgtMidnight, toSgtDateString } from '../models/Availability.js'

export async function listedFilter() {
  const todayStart = sgtMidnight(toSgtDateString(new Date()))
  const sitterIds = await Availability.distinct('sitterId', {
    status: 'available',
    date: { $gte: todayStart }
  })
  return {
    role: 'sitter',
    _id: { $in: sitterIds },
    'sitterProfile.serviceArea.label': { $exists: true, $nin: ['', null] },
    'sitterProfile.services.0': { $exists: true },
    'sitterProfile.petTypes.0': { $exists: true }
  }
}

export async function getSitters(req, res) {
  try {
    const sitters = await User.find(await listedFilter()).select('-password -email')
    res.json(sitters)
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: 'Error in loading sitter profiles' })
  }
}