const mongoose = require("mongoose");

const configIbPartySchema = new mongoose.Schema({
    partyId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    altId: {
        type: String
    },
    parentParty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "config_ib_parties",
        default: null
    },
    street: {
        type: String,
        default: null
    },
    city: {
        type: String,
        default: null
    },
    poBox: {
        type: String,
        default: null
    },
    telephone: {
        type: String,
        default: null
    },
    postcode: {
        type: String,
        default: null
    },
    teleflex: {
        type: String,
        default: null
    },
    country: {
        type: String,
        required: true
    },
    swiftAddress: {
        type: String,
        required: true
    },
    partyRole: {
        type: [String],
        default: [],
/*        enum: ['Bank',
            'Custodian',
            'Counterparty',
            'Issuer',
            'Client',
            'Borrower',
            'Margin Clearer',
            'Bank',
            'Clearing House']*/
    },
    contactPersonId: {
        type: String,
        default: null
    },
    contactName: {
        type: String,
        default: null
    },
    contactTitle: {
        type: String,
        default: null
    },
    contactTelephone: {
        type: String,
        default: null
    },
    contactEmail: {
        type: String,
        default: null
    },
    contactCity: {
        type: String,
        default: null
    },
    contactCountry: {
        type: String,
        default: null
    },
    capitalAmount: {
        type: Number,
        default: 0
    },
    currency: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "config_currencies",
        default: null
    },
    fromDate: {
        type: Date,
        required: true
    },
    isItAsset: {
        type: Boolean,
        required: false
    },
    additionPartyData: [{
        name: {
            type: String,
            unique: true,
            required: true
        },
        value: {
            type: String,
            required: true
        }
    }],
    changedByUser: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref: "users"
    },
    changedDate: {
        type: Date,
        default: null,
        ref: "users"
    },
    createdByUser: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref: "users"
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref: "users"
    },
    deleteReason: {
        type: String,
        default: ''
    }
}, {timestamps: true});

module.exports = mongoose.model("config_ib_parties", configIbPartySchema);
