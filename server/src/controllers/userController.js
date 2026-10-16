import mongoose from 'mongoose'
import User from '../models/UserModel.js'
import Pet from '../models/petModel.js'
import Review from '../models/reviewModel.js'

const PUBLIC_FIELDS = 'username bio profilePicture role sitterProfile createdAt'

export async function getPublicProfile(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'User not found' })
  }
  const user = await User.findById(req.params.id).select(PUBLIC_FIELDS)
  if (!user) return res.status(404).json({ message: 'User not found' })

  if (user.role === 'owner' && !req.session.userId) {
    return res.status(401).json({ message: 'Please log in first.' })
  }
  res.json(user)
}

export async function getUserPets(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'User not found' })
  }
  const owner = await User.findById(req.params.id).select('role')
  if (!owner || owner.role !== 'owner') {
    return res.status(404).json({ message: 'User not found' })
  }
  const pets = await Pet.find({ owner: req.params.id }).sort({ createdAt: -1 })
  res.json(pets)
}

export async function getUserReviews(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'User not found' })
  }
  const reviews = await Review.find({ sitter: req.params.id })
    .populate('owner', 'username')
    .sort({ createdAt: -1 })
  res.json(reviews)
}

export async function updateMyProfile(req, res) {
  const username = req.body.username?.trim()
  const bio = req.body.bio ?? ''

  if (!username) return res.status(400).json({ message: 'Username is required.' })
  if (/[@\s]/.test(username)) {
    return res.status(400).json({ message: "Username can't contain @ or spaces." })
  }

  const updates = { username, bio }

  if (req.session.role === 'owner' && req.body.address && typeof req.body.address === 'object') {
    const line1 = String(req.body.address.line1 ?? '').trim()
    const postalCode = String(req.body.address.postalCode ?? '').trim()

    if (postalCode && !/^\d{6}$/.test(postalCode)) {
      return res.status(400).json({ message: 'Postal code must be 6 digits.' })
    }
    updates['ownerProfile.address.line1'] = line1
    updates['ownerProfile.address.postalCode'] = postalCode
  }
  
  if (req.session.role === 'sitter' && req.body.sitterProfile) {
    const sp = req.body.sitterProfile

    const rate = sp.petsittingRates === '' ? 0 : Number(sp.petsittingRates)
    if (!Number.isFinite(rate) || rate < 0) {
      return res.status(400).json({ message: 'Rate must be 0 or more.' })
    }

    let start = null                                  // null clears the field
    if (sp.experienceStart) {
      start = new Date(`${sp.experienceStart}-01`)
      if (Number.isNaN(start.getTime())) {
        return res.status(400).json({ message: 'Invalid experience date.' })
      }
    }

    updates['sitterProfile.petsittingRates'] = rate
    updates['sitterProfile.experienceStart'] = start
    updates['sitterProfile.petTypes'] = sp.petTypes || []
    updates['sitterProfile.services'] = sp.services || []
    updates['sitterProfile.serviceArea.label'] = (sp.serviceArea || '').trim()
  }

  try {
    const user = await User.findByIdAndUpdate(req.session.userId, updates, {
      new: true,
      runValidators: true
    }).select('+ownerProfile.address')              

    req.session.username = user.username
    res.json(user)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Username is already taken.' })
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(err.errors)[0].message })
    }
    throw err
  }
}