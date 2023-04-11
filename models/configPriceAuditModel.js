const mongoose = require("mongoose");
const {sysConst} = require('../helper/helper');
const accessTypes = sysConst.permissionAccessTypes;

const configPriceAuditSchema = new mongoose.Schema({
    slNo : {
        type: Number,
    },
    securityId : {
        type: String,
        required: true
    },
    priceType : {
        type: String,
        required: true
    },
    priceDate : {
        type: Date,
        required: true,
        default: null
    },
    price : {
        type: Number,
        required: true,
        min: 0,
    },
    currency : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_currencies",
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
        ref : "config_prices"
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

module.exports = mongoose.model("config_price_audits", configPriceAuditSchema);
