import mongoose from 'mongoose'

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
    // default: "owner"
  },
  bio: {
    type: String,
    default: ""
  },
  createdAt: {
    type: Date,
    default: Date.now
  },

  petsittingRates: {
    type: Number,
    default: 0
  }
});

userSchema.statics.getUserByEmail = function(email) {
  return this.findOne({ email });
};

userSchema.statics.getUserByUsername = function(username) {
  return this.findOne({ username });
};

const User = mongoose.model("User", userSchema, "users");

export default User;