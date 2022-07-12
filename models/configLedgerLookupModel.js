const mongoose = require("mongoose");
const { sysConst } = require('../helper/helper');

const configLedgerLookupSchema = new mongoose.Schema({
    ledgerId : {
        type: String,
        required: true
    },
    ledgerName : {
        type: String,
        required: true
    },
    assetClass : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_ib_asset_classes",
    },
    portfolioType : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_portfolio_types",
    },
    accountingFramework : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_ab_frameworks",
    },
    currency : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_currencies",
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
