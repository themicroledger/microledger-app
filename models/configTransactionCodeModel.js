const mongoose = require("mongoose");
const { sysConst } = require('../helper/helper');

const configTransactionCodeSchema = new mongoose.Schema({
    id : {
        type: String,
        required: true
    },
    businessEvent : {
        type: String,
        required: true
    },
    lifeCyclePeriodType : {
        type: String,
        required: true,
        enum: sysConst.transactionCodeLifeCyclePeriodTypes
    },
    windowName : {
        type: String,
        required: true
    },
    instrumentType : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_ib_asset_classes"
    },
    transactionLevel : {
        type: String,
        required: true,
        enum : sysConst.transactionCodeTransactionLevels
    },
    transactionCode : {
        type: String,
        required: true
    },
    secondaryTransactionCode : {
        type: String,
        required: true
    },
    rvOrCanTransactionCode : {
        type: String,
        required: true
    },
    secondaryRvOrCanTransactionCode : {
        type: String,
        required: true
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

module.exports = mongoose.model("config_transaction_codes", configTransactionCodeSchema);
