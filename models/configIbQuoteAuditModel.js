const mongoose = require("mongoose");
const accessTypes = require('../helper/helper').sysConst.permissionAccessTypes;

const configIbQuoteAuditSchema = new mongoose.Schema({
    quoteId: {
        type: Number,
        unique: true,
        min: 1,
        required: true
    },
    quote : {
        type: String,
        required: true
    },
    assetClass: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "config_ib_asset_classes",
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
        ref : "config_ib_quotes",
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

module.exports = mongoose.model("config_ib_quote_audits", configIbQuoteAuditSchema);
