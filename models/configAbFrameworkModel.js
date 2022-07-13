const mongoose = require("mongoose");

const configCostBasisRuleSchema = new mongoose.Schema({
    accountingFramework : {
        type: String,
        required: true
    },
    fromDate : {
        type: Date,
        required: true
    },
    conversionDate : {
        type: Date,
        default: null
    },
    fromBookingLevel : {
        type: mongoose.Schema.Types.ObjectId,
        ref : "config_ib_transaction_statuses",
        required: true
    },
    hierarchy : {
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

module.exports = mongoose.model("config_ab_frameworks", configCostBasisRuleSchema);
