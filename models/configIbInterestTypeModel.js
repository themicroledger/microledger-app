const mongoose = require("mongoose");
const { autoIncrementId } = require('../helper/helper');

const configIbInterestTypeSchema = new mongoose.Schema({
    interestTypeId: {
        type: Number,
        unique: true,
        min: 1,
        required: true
    },
    interestTypeName : {
        type: String,
        required: true
    },
    assetClass: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "config_ib_asset_classes",
    },
    changedByUser: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "users",
    },
    changedDate: {
        type: Date,
        default: null,
        ref : "users",
    },
    createdByUser: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "users",
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "users",
    },
    deleteReason: {
        type: String,
        default: ''
    }
}, { timestamps: true });

configIbInterestTypeSchema.pre('save', function(next) {
    autoIncrementId(model, this, 'interestTypeId', next);
    // Arguments:
    // model: The model const here below
    // this: The schema, the body of the document you wan to save
    // next: next fn to continue
});

const model = mongoose.model("config_ib_interest_types", configIbInterestTypeSchema);
module.exports = model;
