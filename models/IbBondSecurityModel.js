const mongoose = require("mongoose");
const { sysConst } = require('../helper/helper');

const configLedgerLookupSchema = new mongoose.Schema({
    securityId : {
        type: String,
        required: true
    },
    ISIN : {
        type: String,
        required: true
    },
    userDefinedSecurityId : {
        type: String,
        required: true,
        unique: true
    },
    name : {
        type: String,
        required: true
    },
    securityCode : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_security_groups",
    },
    currency : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_currencies",
    },
    paymentHolidayCalender : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_calender_or_bank_holiday_rules",
    },
    exchange : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_ib_exchanges",
    },
    isActive : {
        type: Boolean,
        required: true,
        default: true
    },
    chartOfAccountsReference : {
        type: String
    },
    clientSpecificField1 : {
        type: String
    },
    clientSpecificField2 : {
        type: String
    },
    accountingCalender : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_accounting_calenders",
    },
    ledgerStartDate : {
        type: Date,
        required: true
    },
    ledgerEndDate : {
        type: Date,
        required: true
    },
    ledgerType : {
        type: String,
        required: true,
        default: sysConst.ledgerTypes.Parent,
        enum: sysConst.ledgerTypes
    },
    parentLedger:{
        type: mongoose.Schema.Types.ObjectId,
        ref : "config_ledger_lookups",
        default: null
    },
    ruleOrder:{
        type: Number,
        max: 99,
        min: 0,
        default: 0,
        required: true
    },
    comments : {
        type: String
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

module.exports = mongoose.model("config_ledger_lookups", configLedgerLookupSchema);
