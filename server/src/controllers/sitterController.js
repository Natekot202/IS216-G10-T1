import User from '../models/UserModel.js'


export async function getSitters(req, res) {
    try {
        const sitters = await User.find({role:'sitter'})
        res.json(sitters)
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: 'Error in loading sitter profiles' });
    }
}


// export async function getPets(req, res) {
//   try {
//     const pets = await Pet.find({ owner: req.session.userId }).sort({ createdAt: -1 })
//     res.json(pets)
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: 'Error in loading pets' });
//   }
// }

// export async function getPetById(req, res) {
//   const pet = await Pet.findOne({ _id: req.params.id, owner: req.session.userId })
//   if (!pet) return res.status(404).json({ message: 'Pet not found' })
//   res.json(pet)
// }

// export async function createPet(req, res) {
//   try {
//     const { name, species, breed, age, description } = req.body

//     if (!name || !species) {
//       return res.status(400).json({ message: 'name and species are required' });
//     }

//     const pet = await Pet.create({ owner: req.session.userId, name, species, breed, age, description })
//     res.status(201).json(pet);
//   } catch(err) {
//     console.error(err);
//     return res.status(500).json({ message: 'Error adding pets'})
//   }
// }

// export async function updatePet(req, res) {
//   const { name, species, breed, age, description } = req.body   // whitelist, same as create
//   const pet = await Pet.findOneAndUpdate(
//     { _id: req.params.id, owner: req.session.userId },
//     { name, species, breed, age, description },
//     { new: true, runValidators: true }
//   )
//   if (!pet) return res.status(404).json({ message: 'Pet not found' })
//   res.json(pet)
// }

// export async function deletePet(req, res) {
//   try {
//     const pet = await Pet.findOneAndDelete({ _id: req.params.id, owner: req.session.userId })
//     if (!pet) {
//       return res.status(404).json({ message: 'Pet not found' })
//     }
//     res.json({ message: 'Pet removed' })
//   } catch(err) {
//     console.error(err);
//     return res.status(500).json({ message: 'Error deleting pets'})
//   }
// }