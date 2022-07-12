const mongoose = require("mongoose");
const { sysConst } = require('../helper/helper');

const configAccountingCalenderSchema = new mongoose.Schema({
    acId : {
        type: String,
        required: true
    },
    acName : {
        type: String,
        required: true
    },
    accountingYearType : {
        type: String,
        required: true
    },
    accountingYearEndDate : {
        type: Date,
        required: true
    },
    periodUnits : {
        type: String,
        required: true,
        enum: sysConst.acPeriodUnit,
        default: sysConst.acPeriodUnit.Month
    },
    calenderStartDate : {
        type: Date,
        required: true
    },
    calenderEndDate : {
        type: Date,
        required: true
    },
    calenderActiveStatus : {
        type: Boolean,
        required: true,
        default: false
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

module.exports = mongoose.model("config_accounting_calenders", configAccountingCalenderSchema);
