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


