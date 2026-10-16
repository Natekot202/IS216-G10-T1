import mongoose from 'mongoose'

const petSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true 
  },
  species: {
    type: String,
    required: true,
    trim: true 
  },
  breed: {
    type: String,
    trim: true 
  },
  ageMonths: { 
    type: Number,
    min: 0,
    max: 600
  },
  description: {
    type: String,
    trim: true 
  }
  }
  // { timestamps: true }
)

export default mongoose.model('Pet', petSchema)
