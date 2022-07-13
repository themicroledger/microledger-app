const mongoose = require("mongoose");

const configAccountingTreatmentLookupSchema = new mongoose.Schema({
    atlId : {
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
    accrualStatus: {
        type: String,
        required: true
    },
    isActive : {
        type: Boolean,
        required: true,
        default: true
    },
    clientSpecificField1 : {
        type: String
    },
    clientSpecificField2 : {
        type: String
    },
    accountingTreatment : {
        type: Number,
        required: true,
        min: 1,
        max: 99
    },
    accountingTreatmentDescription : {
        type: String,
        required: true
    },
    effectiveStartDate : {
        type: Date,
        required: true
    },
    effectiveEndDate : {
        type: Date,
        required: true
    },
    ruleOrder:{
        type: Number,
        max: 99,
        min: 1,
        default: 1,
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

module.exports = mongoose.model("config_accounting_treatment_lookups", configAccountingTreatmentLookupSchema);
