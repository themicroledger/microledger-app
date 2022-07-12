const mongoose = require("mongoose");

const configIbExchangeSchema = new mongoose.Schema({
    id : {
        type: String,
        required: true
    },
    name : {
        type: String,
        required: true
    },
    country : {
        type: String,
        required: true
    },
    holidayCalender : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_calender_or_bank_holiday_rules"
    },
    realStockExchange : {
        type: Boolean,
        required: true,
        default: false
    },
    iso10383Mic : {
        type: String
    },
    iso10383Accr : {
        type: String
    },
    reutersExchangeCode : {
        type: String
    },
    swift : {
        type: String
    },
    exchangeClientSpecificCodes : [{
        key: String,
        val: Number
    }],
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

module.exports = mongoose.model("config_ib_exchanges", configIbExchangeSchema);
