import mongoose from 'mongoose'

// A walking route an owner recorded by walking it.
// Every route starts and ends at the owner's home (checked in the controller).

// GeoJSON line: the same shape MapLibre draws, so the client can use it directly
const lineStringSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['LineString'], required: true },
    coordinates: {
      type: [[Number]],   // [[lng, lat], [lng, lat], ...]
      required: true,
      validate: {
        validator: (c) => c.length >= 2,
        message: 'A route needs at least 2 points.'
      }
    }
  },
  { _id: false }
)

const walkRouteSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    path: { type: lineStringSchema, required: true },
    distanceM: { type: Number, required: true, min: 0 }   // total length in metres
  },
  { timestamps: true }
)

const WalkRoute = mongoose.model('WalkRoute', walkRouteSchema, 'walkroutes')

export default WalkRoute
