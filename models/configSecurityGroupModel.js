const mongoose = require("mongoose");

const configSecurityGroupSchema = new mongoose.Schema({
    securityCode : {
        type: String,
        required: true
    },
    securityGroup : {
        type: String,
        required: true
    },
    securityGroupName : {
        type: String,
        required: true
    },
    assetClass: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_ib_asset_classes"
    },
    securityType : {
        type: String,
        required: true
    },
    securityTypeName : {
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

module.exports = mongoose.model("config_security_groups", configSecurityGroupSchema);
