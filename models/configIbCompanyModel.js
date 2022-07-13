const mongoose = require("mongoose");

const configIbCompanySchema = new mongoose.Schema({
    id : {
        type: String,
        required: true
    },
    name : {
        type: String,
        required: true
    },
    altId : {
        type: String
    },
    party : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_ib_parties"
    },
    street : {
        type: String
    },
    city : {
        type: String
    },
    poBox : {
        type: String
    },
    telephone : {
        type: String
    },
    postCode : {
        type: String
    },
    telefex : {
        type: String
    },
    country : {
        type: String,
        required: true
    },
    swiftAddress : {
        type: String
    },
    changedByUser: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "users"
    },
    changedDate: {
        type: Date,
        default: null,
        ref : "users"
    },
    createdByUser: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "users"
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "users"
    },
    deleteReason: {
        type: String,
        default: ''
    }
}, { timestamps: true });

module.exports = mongoose.model("config_ib_companies", configIbCompanySchema);
