const mongoose = require("mongoose");
const accessTypes = require('../helper/helper').sysConst.permissionAccessTypes;

const configSecurityGroupAuditSchema = new mongoose.Schema({
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
        ref : "config_calender_or_bank_holiday_rules"
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
    },
    actionItemId:{
        type: mongoose.Schema.Types.ObjectId,
        ref : "config_currencies"
    },
    action: {
        type: String,
        default: '',
        enum: [accessTypes.CREATE, accessTypes.EDIT, accessTypes.DELETE]
    },
    actionDate: {
        type: Date
    },
    actionBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "users"
    }
}, { timestamps: true });

module.exports = mongoose.model("config_currency_audits", configSecurityGroupAuditSchema);
