const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const bcryptSalt = process.env.BCRYPT_SALT;

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  profilePicUrl: {
    type: String,
    default: ''
  },
  dob: {
    type: String,
    default: ''
  },
  gender: {
    type: String,
    default: ''
  },
  roles: [{
    type: String,
    ref: 'user_roles',
    foreign: 'name'
  }],
  lastLoggedIn: {
    type: Date,
    default: null
  },
  status:{
    type:String
  },
  isVerified: {
    type: Boolean,
    required: false,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  deleteReason: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model("users", userSchema);
