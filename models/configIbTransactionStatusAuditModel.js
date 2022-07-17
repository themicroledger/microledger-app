const mongoose = require("mongoose");
const accessTypes = require('../helper/helper').sysConst.permissionAccessTypes;

const configIbTransactionStatusAuditSchema = new mongoose.Schema({
    transactionId: {
        type: Number
    },
    transactionStatus : {
        type: String,
        required: true
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
        ref : "config_ib_transaction_statuses",
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

module.exports = mongoose.model("config_ib_transaction_status_audits", configIbTransactionStatusAuditSchema);
