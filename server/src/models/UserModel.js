import mongoose from 'mongoose'

export const pet_types = ["Dog", "Cat", "Bird", "Rabbit", "Hamster"];
export const services = ["Feeding", "Dog walking", "Cat walking", "Feeding Medication"]

// location schema
const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"] },
    coordinates: { type: [Number], default: undefined }
  },
  { _id: false }
);

//address schema containing location schema
const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true },
    postalCode: { type: String, trim: true, match: /^\d{6}$/ }, 
    location: pointSchema                                       
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["owner", "sitter"],
    required: true
  },
  bio: {
    type: String,
    default: "",
    maxLength: 500
  },
  
  profilePicture: {
    url: { 
      type: String, 
      default: "" 
    },        
    publicId: { 
      type: String, 
      default: "" 
    }    
  },

  ownerProfile: {
    address: { type: 
      addressSchema, 
      select: false }   
  },

  sitterProfile: {
    petsittingRates: { 
      type: Number, 
      default: 0,
      min: 0 
    },             
    experienceStart: { 
      type: Date 
    },                
    petTypes: { 
      type: [{ 
        type: String, 
        enum: pet_types 
      }], 
      default: [] 
    },
    services: { 
      type: [{ 
        type: String, 
        enum: services 
      }], 
      default: [] 
    },
    serviceArea: {
      label: { 
        type: String, 
        trim: true 
      },
      radiusKm: { 
        type: Number, 
        min: 0, 
        max: 50,
      },
      location: pointSchema
    },
    ratingAvg: { 
      type: Number, 
      default: 0, 
      min: 0, 
      max: 5 
    },
    ratingCount: { 
      type: Number, 
      default: 0, 
      min: 0 
    }
  }
},
{ timestamps: true }
);

userSchema.statics.getUserByEmail = function(email) {
  return this.findOne({ email });
};

userSchema.statics.getUserByUsername = function(username) {
  return this.findOne({ username });
};

const User = mongoose.model("User", userSchema, "users");

export default User;