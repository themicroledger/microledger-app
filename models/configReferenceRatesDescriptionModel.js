const mongoose = require("mongoose");
const { sysConst } = require('../helper/helper');

const configReferenceRatesDescriptionSchema = new mongoose.Schema({
    bankHoliday : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_calender_or_bank_holiday_rules"
    },
    currency : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_currencies"
    },
    referenceRate : {
        type: String,
        required: true
    },
    referenceRateName : {
        type: String,
        required: true
    },
    termLength : {
        type: Number,
        required: true,
        default: 0
    },
    termUnit : {
        type: String,
        required: true,
        enum: sysConst.referenceTermUnit
    },
    marketIdentifier : {
        type: String
    },
    pricingSource : {
        type: String
    },
    rateConvention : {
        type: String,
        required: true,
        enum: sysConst.referenceRateConvention
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

module.exports = mongoose.model("config_reference_rates_descriptions", configReferenceRatesDescriptionSchema);
