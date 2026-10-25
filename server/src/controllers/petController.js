import Pet from '../models/petModel.js'
import mongoose from 'mongoose'
import { uploadImage, deleteImage } from '../config/cloudinary.js'

export async function getPets(req, res) {
  try {
    const pets = await Pet.find({ owner: req.session.userId }).sort({ createdAt: -1 })
    res.json(pets)
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error in loading pets' });
  }
}

export async function getPetById(req, res) {
  const pet = await Pet.findOne({ _id: req.params.id, owner: req.session.userId })
  if (!pet) return res.status(404).json({ message: 'Pet not found' })
  res.json(pet)
}

export async function createPet(req, res) {
  let photo;
  try {
    const { name, species, breed, ageMonths, description } = req.body

    if (!name || !species) {
      return res.status(400).json({ message: 'name and species are required' });
    }

    if (req.file) {
      const r = await uploadImage(req.file.buffer, {
        folder: 'petsociety/pets',
        transformation: [{ width: 800, height: 800, crop: 'limit' }] 
      })
      photo = { url: r.secure_url, publicId: r.public_id }
    }

    const pet = await Pet.create({ owner: req.session.userId, name, species, breed, ageMonths, description, photo })
    res.status(201).json(pet);
  } catch(err) {
    await deleteImage(photo?.publicId)
    console.error(err);
    return res.status(500).json({ message: 'Error adding pets'})
  }
}

export async function updatePet(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Pet not found' })
  }
  const pet = await Pet.findOne({ _id: req.params.id, owner: req.session.userId })
  if (!pet) {
    return res.status(404).json({ message: 'Pet not found' })
  }

  const { name, species, breed, description, ageMonths, removePhoto } = req.body

  if (!name?.trim() || !species?.trim()) {
    return res.status(400).json({ message: 'name and species are required' })
  }

  let months
  if (ageMonths !== undefined && ageMonths !== '') {
    months = Number(ageMonths)
    if (!Number.isInteger(months) || months < 0 || months > 600) {
      return res.status(400).json({ message: 'Invalid age.' })
    }
  }

  pet.name = name.trim()
  pet.species = species.trim()
  pet.breed = String(breed ?? '').trim()
  pet.description = String(description ?? '').trim()
  pet.ageMonths = months            

  const oldPublicId = pet.photo?.publicId
  let newPhoto
  try {
    if (req.file) {
      const r = await uploadImage(req.file.buffer, {
        folder: 'petsociety/pets',
        transformation: [{ width: 800, height: 800, crop: 'limit' }]
      })
      newPhoto = { url: r.secure_url, publicId: r.public_id }
      pet.photo = newPhoto
    } else if (removePhoto === '1') {
      pet.photo = { url: '', publicId: '' }
    }
    await pet.save()
  } catch (err) {
    await deleteImage(newPhoto?.publicId)      
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(err.errors)[0].message })
    }
    throw err
  }

  if ((newPhoto || removePhoto === '1') && oldPublicId) {
    await deleteImage(oldPublicId)
  }
  res.json(pet)
}

export async function deletePet(req, res) {
  try {
    const pet = await Pet.findOneAndDelete({ _id: req.params.id, owner: req.session.userId })
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' })
    }
    await deleteImage(pet.photo?.publicId) 
    res.json({ message: 'Pet removed' })
  } catch(err) {
    console.error(err);
    return res.status(500).json({ message: 'Error deleting pets'})
  }
}
