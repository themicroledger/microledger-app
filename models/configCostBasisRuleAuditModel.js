const mongoose = require("mongoose");
const accessTypes = require('../helper/helper').sysConst.permissionAccessTypes;

const configCostBasisRuleAuditSchema = new mongoose.Schema({
    costBasisProfileId : {
        type: String,
        required: true
    },
    costBasisProfileName : {
        type: String,
        required: true
    },
    cbaRuleId : {
        type: String,
        required: true
    },
    cbaRuleName : {
        type: String,
        required: true
    },
    cbaRuleType : {
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

module.exports = mongoose.model("config_cost_basis_rule_audits", configCostBasisRuleAuditSchema);
