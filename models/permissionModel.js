const mongoose = require("mongoose");
const accessTypes = require('../helper/helper').sysConst.permissionAccessTypes;

const userPermissionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    accessType:{
        type: String,
        enum: ['C', 'R', 'E', 'D'],
        default : accessTypes.READ
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

module.exports = mongoose.model("user_role_permissions", userPermissionSchema);