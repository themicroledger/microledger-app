const mongoose = require("mongoose");

const configCalenderOrBankHolidaySchema = new mongoose.Schema({
    calenderId : {
        type: String,
        required: true
    },
    calenderName : {
        type: String,
        required: true
    },
    Country : {
        type: String,
        required: true
    },
    irregularNonBankingDays : [{
        date: {
            type: Date,
            required: true
        },
        description: {
            type: String,
            required: true
        }
    }],
    sunday : {
        type: Boolean,
        required: true,
        default: false,
    },
    monday : {
        type: Boolean,
        required: true,
        default: false,
    },
    tuesday : {
        type: Boolean,
        required: true,
        default: false,
    },
    wednesday : {
        type: Boolean,
        required: true,
        default: false,
    },
    thursday : {
        type: Boolean,
        required: true,
        default: false,
    },
    saturday : {
        type: Boolean,
        required: true,
        default: false,
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

module.exports = mongoose.model("config_calender_or_bank_holiday_rules", configCalenderOrBankHolidaySchema);
