const mongoose = require("mongoose");
const { sysConst } = require('../helper/helper');

const configLedgerLookupSchema = new mongoose.Schema({
    securityId : {
        type: String,
        required: true
    },
    ISIN : {
        type: String,
        required: true
    },
    userDefinedSecurityId : {
        type: String,
        required: true,
        unique: true
    },
    name : {
        type: String,
        required: true
    },
    securityCode : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_security_groups",
    },
    currency : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_currencies",
    },
    paymentHolidayCalender : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_calender_or_bank_holiday_rules",
    },
    exchange : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_ib_exchanges",
    },
    quoted : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_ib_quotes",
    },
    minTradeVolume : {
        type: Number,
    },
    volume : {
        required: true,
        type: Number,
    },
    issuer : {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_ib_parties",
    },
    issueDate: {
        type: Date
    },
    issuePrice: {
        required: true,
        type: Number
    },
    redemptionPrice:{
        required: true,
        type: Number
    },
    redemptionCurrency:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref : "config_currencies",
    },
    interestType:{
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "config_ib_interest_types",
    },
    couponRate : {
        type: String,
        required: true
    },
    maturityDate : {
        type: Date
    },
    structure:{
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "config_ib_structures",
    },
    firstRedemptionDate: {
        type: Date
    },
    couponTerm : {
        type: Number,
        required: true
    },
    couponTermUnit : {
        type: String,
        required: true,
        enum: sysConst.referenceTermLength
    },
    redemptionTerm : {
        type: Number,
        required: true
    },
    redemptionTermUnit : {
        type: String,
        required: true,
        enum: sysConst.referenceTermLength
    },
    inceptionRedemptionRate: {
        type: String
    },
    currentPoolFactor:{
        type: String
    },
    firstCouponPaymentDate:{
        type:Date
    },
    quotation:{
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "config_ib_quotes",
    },
    settlementDays : {
        type: Number
    },
    quoteType : {
        type: Number //Possible values: 0 = Others, 1= Per unit, 2= Percent, 3=Per mile, 4= Points, 5=Pips
    },
    quotingLotSize : {
        type: Number,
    },
    quotingFaceValue : {
        type: Number,
    },
    couponConventionDayCount : {
        type: Number,
    },
    couponConventionPaymentDayConvention : {
        type: Date,
    },
    couponConventionTreasuryTermCoupon : {
        type: Boolean,
        default: false
    },
    couponConventionEndOfMonthConvention : {
        type: Date,
    },
    couponConventionTreasuryTermCouponBase : {
        type: Boolean,
        default: false
    },
    couponConventionHolidayAdjustedCouponFlag : {
        type: Boolean,
        default: false
    },
    couponConventionPaymentType : {
        type: String,
    },
    couponConventionFixedRateDeCompounding : {
        type: Boolean,
        default: false
    },
    couponConventionInclExclOneDay : {
        type: Boolean,
        default: false
    },
    couponConventionSequenceConvention : {
        type: String,
    },
    oddCouponsAndRedempOddConvLastCoupon : {
        type: String,
        enum: sysConst.lastCoupon,
        default: null
    },
    oddCouponsAndRedempOddConvLastRedeption : {
        type: String,
        enum: sysConst.lastCoupon,
        default: null
    },
    sequenceConventionRedemption : {
        type: String,
    },
    couponConventionsDayCount : {
        type: String,
    },
    accruedInterestConventionsInterestType : {
        type: Boolean,
        default: false
    },
    accruedInterestConventionsTreasuryProduct : {
        type: Boolean,
        default: false
    },
    accruedInterestConventionsDayCountConvention : {
        type: String
    },
    accruedInterestConventionsCalculationMethod : {
        type: String
    },
    floatingRatesReferenceRate : {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "config_reference_rates_descriptions",
    },
    floatingRatesSpreadRate : {
        type: Number
    },
    interestLookBackPeriod : {
        type: Number
    },
    interestMultiplierFactor : {
        type: Number
    },
    interestAdjustmentFixingDays : {
        type: Boolean,
        default: false
    },
    defaultFixingDate: {
        type: String
    },
    defaultFixingRate: Number,
    fixingTerm: Number,
    fixingUnits: {
        type: String,
        default: null,
        enum: sysConst.acPeriodUnit
    },
    rateResetHolidayCalender : {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        ref : "config_calender_or_bank_holiday_rules",
    },
    compoundingConvention: {
        type: String,
        default: null,
        enum: sysConst.compoundingConvention
    },
    spreadConventionOrCompounding: {
        type: String,
        default: null,
        enum: sysConst.spreadConventionOrCompounding
    },
    couponRateMinimum: Number,
    couponRateMaximum: Number,
    alternativeSecurityIdIdentificationSystem: String,
    alternativeSecurityIdLongSecurityName: String,
    alternativeSecurityIdCusip: String,
    alternativeSecurityIdIsin: String,
    putCalls: [{
        fromDate: {
            type: String,
            required: true
        },
        toDate: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            min: 0,
            required: true
        },
        noOfDays: {
            type: Number,
            min: 0,
            required: true
        },
        optionType: {
            type: String,
            required: true,
            enum: sysConst.putCall
        }
    }],
    clientSpecificFields: [{
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
    attachments: [ String ],
    comments: String,
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

module.exports = mongoose.model("config_bond_securities", configLedgerLookupSchema);
