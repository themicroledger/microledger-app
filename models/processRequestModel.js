const mongoose = require("mongoose");
const { autoIncrementId, sysConst } = require('../helper/helper');

const processRequestSchema = new mongoose.Schema({
    processId : {
        type: Number,
        unique: true,
        min: 1
    },
    processName : {
        type: String,
        required: true
    },
    processType : {
        type: String,
        required: true,
        default: sysConst.processType.BulkInsert,
        enum: sysConst.processType
    },
    processStatus: {
        type: String,
        required: true,
        default: sysConst.processStatus.Initialised,
        enum: sysConst.processStatus,
    },
    processData:{
        type: Object,
        default: {}
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

processRequestSchema.pre('save', function(next) {
    autoIncrementId(model, this, 'processId', next);
    // Arguments:
    // model: The model const here below
    // this: The schema, the body of the document you wan to save
    // next: next fn to continue
});

const model = mongoose.model("process_requests", processRequestSchema);

module.exports = model;