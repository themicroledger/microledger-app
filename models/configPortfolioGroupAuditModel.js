const mongoose = require("mongoose");
const accessTypes = require('../helper/helper').sysConst.permissionAccessTypes;

const configPortfolioGroupAuditSchema = new mongoose.Schema({
    id : {
        type: String,
        required: true
    },
    name : {
        type: String,
        required: true
    },
    portfolioGroupType : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_portfolio_types"
    },
    company : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_ib_companies"
    },
    manager : {
        type: String,
        default: ''
    },
    portfolioCurrency : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_currencies"
    },
    endOfYear : {
        type: String,
        default: '',
    },
    portfolioGroupLevelBooking : {
        type: Boolean,
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
        ref : "config_portfolio_groups"
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

module.exports = mongoose.model("config_portfolio_group_audits", configPortfolioGroupAuditSchema);
