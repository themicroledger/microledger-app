const mongoose = require("mongoose");

const configRoundingTableSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    instrumentType: {
        type: String
    },
    fieldToBeRounded: {
        type: String,
        required: true,
        default: ''
    },
    roundingValue: {
        type: String,
        default: null
    },
    roundingType: {
        type: String,
        default: null
    },
    changedByUser: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref: "users"
    },
    changedDate: {
        type: Date,
        default: null,
        ref: "users"
    },
    createdByUser: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref: "users"
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref: "users"
    },
    deleteReason: {
        type: String,
        default: ''
    }
}, {timestamps: true});

module.exports = mongoose.model("config_rounding_tables", configRoundingTableSchema);
