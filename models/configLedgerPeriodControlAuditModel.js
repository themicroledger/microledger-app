const mongoose = require("mongoose");
const { sysConst } = require('../helper/helper');
const accessTypes = sysConst.permissionAccessTypes;

const configLedgerPeriodControlAuditSchema = new mongoose.Schema({
    ledgerId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "config_ledger_lookups",
    },
    accountingPeriod: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "config_accounting_period_definitions",
    },
    periodClosedStatus: {
        type: String,
        required: true,
        enum : sysConst.ledgerPeriodStatus,
    },
    changedByUser: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "users",
    },
    changedDate: {
        type: Date,
        default: null,
        ref : "users",
    },
    createdByUser: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "users",
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "users",
    },
    deleteReason: {
        type: String,
        default: ''
    },
    actionItemId:{
        type: mongoose.Schema.Types.ObjectId,
        ref : "config_ledger_period_controls",
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
        ref : "users",
    }
}, { timestamps: true });

module.exports = mongoose.model("config_ledger_period_control_audits", configLedgerPeriodControlAuditSchema);
