const mongoose = require("mongoose");

const configCostBasisRuleSchema = new mongoose.Schema({
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
    }
}, { timestamps: true });

module.exports = mongoose.model("config_cost_basis_rules", configCostBasisRuleSchema);
