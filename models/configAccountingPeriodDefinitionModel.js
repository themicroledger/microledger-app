const mongoose = require("mongoose");
const { sysConst } = require('../helper/helper');

const configAccountingPeriodDefinitionSchema = new mongoose.Schema({
    apId : {
        type: Number,
        min: 1,
        required: true
    },
    apName : {
        type: String,
        required: true
    },
    accountingCalender : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_accounting_calenders",
    },
    periodType : {
        type: String,
        required: true,
        enum: sysConst.periodTypes,
    },
    apStartDate : {
        type: Date,
        required: true
    },
    apEndDate : {
        type: Date,
        required: true
    },
    priorMonthClosingDate : {
        type: Date,
        required: true
    },
    accountingQuarter : {
        type: String,
        required: true
    },
    accountingYear : {
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

module.exports = mongoose.model("config_accounting_period_definitions", configAccountingPeriodDefinitionSchema);
