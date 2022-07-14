const mongoose = require("mongoose");
const accessTypes = require('../helper/helper').sysConst.permissionAccessTypes;

const configCalenderOrBankHolidayAuditSchema = new mongoose.Schema({
    calenderId : {
        type: String,
        required: true
    },
    calenderName : {
        type: String,
        required: true
    },
    country : {
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
    },
    actionItemId:{
        type: mongoose.Schema.Types.ObjectId,
        ref : "config_cost_basis_rules"
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
    },
}, { timestamps: true });

module.exports = mongoose.model("config_calender_or_bank_holiday_rule_audits", configCalenderOrBankHolidayAuditSchema);
