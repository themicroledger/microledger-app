const mongoose = require("mongoose");

const configSecurityGroupSchema = new mongoose.Schema({
    currency : {
        type: String,
        required: true
    },
    currencyName : {
        type: String,
        required: true
    },
    bankHolidays: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_calender_or_bank_holiday_rule_audits"
    },
    settlementDays : {
        type: Number,
        required: true
    },
    ISDACurrencyNotation : {
        type: String,
        required: true
    },
    decimals : {
        type: Number,
        required: true
    },
    roundingTruncation : {
        type: Boolean,
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

module.exports = mongoose.model("config_currencies", configSecurityGroupSchema);
