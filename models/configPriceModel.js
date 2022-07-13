const mongoose = require("mongoose");
const { sysConst, autoIncrementId } = require('../helper/helper');

const configPriceSchema = new mongoose.Schema({
    slNo : {
        type: Number,
        unique: true,
        min: 1,
        required: true
    },
    securityId : {
        type: String,
        required: true
    },
    priceType : {
        type: String,
        required: true
    },
    priceDate : {
        type: Date,
        required: true,
        default: null
    },
    price : {
        type: Number,
        required: true,
        min: 0,
    },
    currency : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_currencies",
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

configPriceSchema.pre('save', function(next) {
    autoIncrementId(model, this, 'slNo', next);
    // Arguments:
    // model: The model const here below
    // this: The schema, the body of the document you wan to save
    // next: next fn to continue
});

const model = mongoose.model("config_prices", configPriceSchema);
module.exports = model;
