const mongoose = require("mongoose");
const { autoIncrementId } = require('../helper/helper');

const configPortfolioTypeSchema = new mongoose.Schema({
    portfolioTypeId: {
        type: Number,
        unique: true,
        min: 1,
        required: true
    },
    portfolioGroupType : {
        type: String,
        required: true
    },
    portfolioType : {
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
    }
}, { timestamps: true });

configPortfolioTypeSchema.pre('save', function(next) {
    autoIncrementId(model, this, 'portfolioTypeId', next);
    // Arguments:
    // model: The model const here below
    // this: The schema, the body of the document you wan to save
    // next: next fn to continue
});
const model = mongoose.model("config_portfolio_types", configPortfolioTypeSchema);
module.exports = model;
