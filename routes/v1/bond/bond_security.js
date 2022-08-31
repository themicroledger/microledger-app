const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const moment = require('moment');
const br = helper.baseResponse;
const router = new express.Router();
const {bulkUploader, bondAttachUploader} = require('../helper/file_uploader');
const SecurityGroupModel = require('../../../models/configSecurityGroupModel');
const CurrencyModel = require('../../../models/configCurrencyModel');
const CalenderOrBankHolidayModel = require('../../../models/configCalenderOrBankHolidayModel');
const IbExchangeModel = require('../../../models/configIbExchangeModel');
const IbQuote = require('../../../models/configIbQuoteModel');
const IbParty = require('../../../models/configIbPartyModel');
const IbInterestType = require('../../../models/configIbInterestTypeModel');
const ReferenceRateModel = require('../../../models/configReferenceRatesDescriptionModel');
const BondSecurityModel = require('../../../models/bondSecurityModel');
const BondSecurityAuditModel = require('../../../models/bondSecurityAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId} = require('../../../middleware/auth');
const bondSecurityMiddleware = require('../../../middleware/bond_security_middleware');

let bondDataValidator = {

    generalDetailsValidator: (inputData, callback) => {
        const v = new Validator(inputData, {
            securityId: 'required|string',
            ISIN: 'string',
            userDefinedSecurityId: 'required|string',
            name: 'required|string',
            securityCode: 'required|string',
            currency: 'required|string',
            paymentHolidayCalender: 'required|string',
            exchange: 'required|string',
            quoted: 'required|string',
            minTradeVolume: 'numeric',
            volume: 'required|numeric',
            issuer: 'required|string',
            issueDate: 'string',
            issuePrice: 'required|numeric',
            redemptionPrice: 'required|numeric',
            redemptionCurrency: 'required|string',
            interestType: 'required|string',
            couponRate: 'required|string',
            maturityDate: 'string',
            structure: 'required|string',
            firstRedemptionDate: 'string',
            couponTerm: 'numeric',
            couponTermUnit: 'required|string',
            redemptionTerm: 'numeric',
            redemptionTermUnit: 'required|string',
            inceptionRedemptionRate: 'string',
            currentPoolFactor: 'string',
            firstCouponPaymentDate: 'string',
        });

        v.check().then(async (matched) => {
            if (!matched) {
                callback(v.errors, null, 'Missing required fields');
            } else {
                let data = {
                    securityId: inputData.securityId,
                    ISIN: inputData.ISIN,
                    userDefinedSecurityId: inputData.userDefinedSecurityId,
                    name: inputData.name,
                    securityCode: inputData.securityCode,
                    currency: inputData.currency,
                    paymentHolidayCalender: inputData.paymentHolidayCalender,
                    exchange: inputData.exchange,
                    quoted: inputData.quoted,
                    minTradeVolume: inputData.minTradeVolume,
                    volume: inputData.volume,
                    issuer: inputData.issuer,
                    issueDate: inputData.issueDate,
                    issuePrice: inputData.issuePrice,
                    redemptionPrice: inputData.redemptionPrice,
                    redemptionCurrency: inputData.redemptionCurrency,
                    interestType: inputData.interestType,
                    couponRate: inputData.couponRate,
                    maturityDate: inputData.maturityDate,
                    structure: inputData.structure,
                    firstRedemptionDate: inputData.firstRedemptionDate,
                    couponTerm: inputData.couponTerm,
                    couponTermUnit: inputData.couponTermUnit,
                    redemptionTerm: inputData.redemptionTerm,
                    redemptionTermUnit: inputData.redemptionTermUnit,
                    inceptionRedemptionRate: inputData.inceptionRedemptionRate,
                    currentPoolFactor: inputData.currentPoolFactor,
                    firstCouponPaymentDate: inputData.firstCouponPaymentDate,
                };

                if ((await BondSecurityModel.find({userDefinedSecurityId: data.userDefinedSecurityId})).length > 0) {
                    return callback({}, null, `Bond Security is present with userDefinedSecurityId: ${data.userDefinedSecurityId}!`);
                }

                if (!helper.isValidObjectId(data.securityCode)) {
                    return callback({}, null, 'securityCode is not a valid Security Group Id!');
                } else {
                    const itemDetails = await SecurityGroupModel
                        .find({_id: data.securityCode, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback({}, null, 'Invalid Security Group Id for securityCode => ' + data.securityCode + '!');
                    }
                }

                if (!helper.isValidObjectId(data.currency)) {
                    return callback({}, null, 'currency is not a valid Currency Id!');
                } else {
                    const itemDetails = await CurrencyModel
                        .find({_id: data.currency, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback({}, null, 'Invalid Currency Id for currency => ' + data.currency + '!');
                    }
                }

                if (!helper.isValidObjectId(data.paymentHolidayCalender)) {
                    return callback({}, null, 'paymentHolidayCalender is not a valid Calender Or Bank Holiday Id!');
                } else {
                    const itemDetails = await CalenderOrBankHolidayModel
                        .find({_id: data.paymentHolidayCalender, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback({}, null, 'Invalid Calender Or Bank Holiday Id for paymentHolidayCalender => ' + data.paymentHolidayCalender + '!');
                    }
                }

                if (!helper.isValidObjectId(data.exchange)) {
                    return callback({}, null, 'exchange is not a valid Ib Exchange Id!');
                } else {
                    const itemDetails = await IbExchangeModel
                        .find({_id: data.exchange, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback({}, null, 'Invalid Ib Exchange Id for exchange => ' + data.exchange + '!');
                    }
                }

                if (!helper.isValidObjectId(data.quoted)) {
                    return callback({}, null, 'quoted is not a valid Ib Quote Id!');
                } else {
                    const itemDetails = await IbQuote
                        .find({_id: data.quoted, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback({}, null, 'Invalid Ib Quote Id for quoted => ' + data.quoted + '!');
                    }
                }

                if (data.minTradeVolume !== undefined && isNaN(Number(data.minTradeVolume))) {
                    return callback({}, null, 'minTradeVolume should have a valid numeric value!');
                }

                if (!helper.isValidObjectId(data.issuer)) {
                    return callback({}, null, 'issuer is not a valid Ib Quote Id!');
                } else {
                    const itemDetails = await IbParty
                        .find({_id: data.issuer, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback({}, null, 'Invalid Ib Quote Id for issuer => ' + data.issuer + '!');
                    }
                }

                if (data.issueDate !== undefined && !moment(data.issueDate).isValid()) {
                    return callback({}, null, 'Invalid Date in issueDate!');
                } else if (data.issueDate !== undefined && moment(data.issueDate).isValid()) {
                    data.issueDate = new Date(moment(data.issueDate).format());
                }

                if (!helper.isValidObjectId(data.interestType)) {
                    return callback({}, null, 'interestType is not a valid Ib InterestType Id!');
                } else {
                    const itemDetails = await IbInterestType
                        .find({_id: data.interestType, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback({}, null, 'Invalid Ib InterestType Id for interestType => ' + data.interestType + '!');
                    }
                }

                if (data.maturityDate !== undefined && !moment(data.maturityDate).isValid()) {
                    return callback({}, null, 'Invalid Date in maturityDate!');
                } else if (data.maturityDate !== undefined && moment(data.maturityDate).isValid()) {
                    data.maturityDate = new Date(moment(data.maturityDate).format());
                }

                if (data.firstRedemptionDate !== undefined && !moment(data.firstRedemptionDate).isValid()) {
                    return callback({}, null, 'Invalid Date in firstRedemptionDate!');
                } else if (data.firstRedemptionDate !== undefined && moment(data.firstRedemptionDate).isValid()) {
                    data.firstRedemptionDate = new Date(moment(data.firstRedemptionDate).format());
                }

                if (data.couponTerm !== undefined && isNaN(Number(data.couponTerm))) {
                    return callback({}, null, 'couponTerm should have a valid numeric value!');
                }

                if (!helper.isObjectContainsKey(helper.sysConst.referenceTermLength, data.couponTermUnit)) {
                    return callback({}, null, 'Invalid couponTermUnit!');
                }

                if (data.redemptionTerm !== undefined && isNaN(Number(data.redemptionTerm))) {
                    return callback({}, null, 'redemptionTerm should have a valid numeric value!');
                }

                if (!helper.isObjectContainsKey(helper.sysConst.referenceTermLength, data.redemptionTermUnit)) {
                    return callback({}, null, 'Invalid redemptionTermUnit!');
                }

                if (data.inceptionRedemptionRate !== undefined && isNaN(Number(data.inceptionRedemptionRate))) {
                    return callback({}, null, 'inceptionRedemptionRate should have a valid numeric value!');
                }

                if (data.currentPoolFactor !== undefined && isNaN(Number(data.currentPoolFactor))) {
                    return callback({}, null, 'currentPoolFactor should have a valid numeric value!');
                }

                if (data.firstCouponPaymentDate !== undefined && !moment(data.firstCouponPaymentDate).isValid()) {
                    return callback({}, null, 'Invalid Date in firstCouponPaymentDate!');
                } else if (data.firstCouponPaymentDate !== undefined && moment(data.firstCouponPaymentDate).isValid()) {
                    data.firstCouponPaymentDate = new Date(moment(data.firstCouponPaymentDate).format());
                }

                callback(null, data, 'All data validated');
            }
        });
    },
    marketConventionValidator: (inputData, callback) => {
        const v = new Validator(inputData, {
            quotation: 'required|string',
            settlementDays: 'numeric',
            quoteType: 'required|numeric',
            quotingLotSize: 'numeric',
            quotingFaceValue: 'required|numeric',
            couponConventionDayCount: 'required|numeric',
            couponConventionPaymentDayConvention: 'required|string',
            couponConventionTreasuryTermCoupon: 'required|boolean',
            couponConventionEndOfMonthConvention: 'required|string',
            couponConventionTreasuryTermCouponBase: 'required|boolean',
            couponConventionHolidayAdjustedCouponFlag: 'required|boolean',
            couponConventionPaymentType: 'required|string',
            couponConventionFixedRateDeCompounding: 'required|boolean',
            couponConventionInclExclOneDay: 'required|boolean',
            couponConventionSequenceConvention: 'required|string',
            oddCouponsAndRedempOddConvLastCoupon: 'required|string',
            oddCouponsAndRedempOddConvLastRedeption: 'required|string',
            sequenceConventionRedemption: 'required|string',
            couponConventionsDayCount: 'required|string',
            accruedInterestConventionsInterestType: 'required|boolean',
            accruedInterestConventionsTreasuryProduct: 'required|boolean',
            accruedInterestConventionsDayCountConvention: 'required|string',
            accruedInterestConventionsCalculationMethod: 'required|string',
        });

        v.check().then(async (matched) => {
            if (!matched) {
                callback(v.errors, null, 'Missing required fields');
            } else {
                let data = {
                    quotation: inputData.quotation,
                    settlementDays: inputData.settlementDays,
                    quoteType: inputData.quoteType,
                    quotingLotSize: inputData.quotingLotSize,
                    quotingFaceValue: inputData.quotingFaceValue,
                    couponConventionDayCount: inputData.couponConventionDayCount,
                    couponConventionPaymentDayConvention: inputData.couponConventionPaymentDayConvention,
                    couponConventionTreasuryTermCoupon: helper.getBoolean(inputData.couponConventionTreasuryTermCoupon),
                    couponConventionEndOfMonthConvention: inputData.couponConventionEndOfMonthConvention,
                    couponConventionTreasuryTermCouponBase: helper.getBoolean(inputData.couponConventionTreasuryTermCouponBase),
                    couponConventionHolidayAdjustedCouponFlag: helper.getBoolean(inputData.couponConventionHolidayAdjustedCouponFlag),
                    couponConventionPaymentType: inputData.couponConventionPaymentType,
                    couponConventionFixedRateDeCompounding: helper.getBoolean(inputData.couponConventionFixedRateDeCompounding),
                    couponConventionInclExclOneDay: helper.getBoolean(inputData.couponConventionInclExclOneDay),
                    couponConventionSequenceConvention: inputData.couponConventionSequenceConvention,
                    oddCouponsAndRedempOddConvLastCoupon: inputData.oddCouponsAndRedempOddConvLastCoupon,
                    oddCouponsAndRedempOddConvLastRedeption: inputData.oddCouponsAndRedempOddConvLastRedeption,
                    sequenceConventionRedemption: inputData.sequenceConventionRedemption,
                    couponConventionsDayCount: inputData.couponConventionsDayCount,
                    accruedInterestConventionsInterestType: helper.getBoolean(inputData.accruedInterestConventionsInterestType),
                    accruedInterestConventionsTreasuryProduct: helper.getBoolean(inputData.accruedInterestConventionsTreasuryProduct),
                    accruedInterestConventionsDayCountConvention: inputData.accruedInterestConventionsDayCountConvention,
                    accruedInterestConventionsCalculationMethod: inputData.accruedInterestConventionsCalculationMethod,
                };

                if (!helper.isValidObjectId(data.quotation)) {
                    return callback({}, null, 'quotation is not a valid IB Quote Id!');
                } else {
                    const itemDetails = await IbQuote
                        .find({_id: data.quotation, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback({}, null, 'Invalid IB Quote Id for quotation => ' + data.quotation + '!');
                    }
                }

                if (data.settlementDays !== undefined && isNaN(Number(data.settlementDays))) {
                    return callback({}, null, 'settlementDays should have a valid numeric value!');
                }

                if (data.quotingLotSize !== undefined && isNaN(Number(data.quotingLotSize))) {
                    return callback({}, null, 'quotingLotSize should have a valid numeric value!');
                }

                if (data.couponConventionPaymentDayConvention !== undefined && !moment(data.couponConventionPaymentDayConvention).isValid()) {
                    return callback({}, null, 'Invalid Date in couponConventionPaymentDayConvention!');
                } else if (data.couponConventionPaymentDayConvention !== undefined && moment(data.couponConventionPaymentDayConvention).isValid()) {
                    data.couponConventionPaymentDayConvention = new Date(moment(data.couponConventionPaymentDayConvention).format());
                }

                if (data.couponConventionEndOfMonthConvention !== undefined && !moment(data.couponConventionEndOfMonthConvention).isValid()) {
                    return callback({}, null, 'Invalid Date in couponConventionEndOfMonthConvention!');
                } else if (data.couponConventionEndOfMonthConvention !== undefined && moment(data.couponConventionEndOfMonthConvention).isValid()) {
                    data.couponConventionEndOfMonthConvention = new Date(moment(data.couponConventionEndOfMonthConvention).format());
                }

                if (data.oddCouponsAndRedempOddConvLastCoupon !== undefined && !helper.isObjectContainsKey(helper.sysConst.lastCoupon, data.oddCouponsAndRedempOddConvLastCoupon)) {
                    return callback({}, null, 'Invalid Data in oddCouponsAndRedempOddConvLastCoupon!');
                }

                if (data.oddCouponsAndRedempOddConvLastRedeption !== undefined && !helper.isObjectContainsKey(helper.sysConst.lastCoupon, data.oddCouponsAndRedempOddConvLastRedeption)) {
                    return callback({}, null, 'Invalid Data in oddCouponsAndRedempOddConvLastRedeption!');
                }

                callback(null, data, 'All data validated');
            }
        });
    },
    referenceRateValidator: (inputData, callback) => {
        const v = new Validator(inputData, {
            floatingRatesReferenceRate: 'string',
            floatingRatesSpreadRate: 'numeric',
            interestLookBackPeriod: 'numeric',
            interestMultiplierFactor: 'numeric',
            interestAdjustmentFixingDays: 'boolean',
            defaultFixingDate: 'string',
            defaultFixingRate: 'numeric',
            fixingTerm: 'numeric',
            fixingUnits: 'required|string',
            rateResetHolidayCalender: 'string',
            compoundingConvention: 'string',
            spreadConventionOrCompounding: 'string',
            couponRateMinimum: 'numeric',
            couponRateMaximum: 'numeric',
        });

        v.check().then(async (matched) => {
            if (!matched) {
                callback(v.errors, null, 'Missing required fields');
            } else {
                let data = {
                    floatingRatesReferenceRate: inputData.floatingRatesReferenceRate,
                    floatingRatesSpreadRate: inputData.floatingRatesSpreadRate,
                    interestLookBackPeriod: inputData.interestLookBackPeriod,
                    interestMultiplierFactor: inputData.interestMultiplierFactor,
                    interestAdjustmentFixingDays: helper.getBoolean(inputData.interestAdjustmentFixingDays),
                    defaultFixingDate: inputData.defaultFixingDate,
                    defaultFixingRate: inputData.defaultFixingRate,
                    fixingTerm: inputData.fixingTerm,
                    fixingUnits: inputData.fixingUnits,
                    rateResetHolidayCalender: inputData.rateResetHolidayCalender,
                    compoundingConvention: inputData.compoundingConvention,
                    spreadConventionOrCompounding: inputData.spreadConventionOrCompounding,
                    couponRateMinimum: inputData.couponRateMinimum,
                    couponRateMaximum: inputData.couponRateMaximum,
                };

                if (!helper.isValidObjectId(data.floatingRatesReferenceRate)) {
                    return callback({}, null, 'floatingRatesReferenceRate is not a valid Reference Rate Id!');
                } else {
                    const itemDetails = await ReferenceRateModel
                        .find({_id: data.floatingRatesReferenceRate, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback({}, null, 'Invalid Reference Rate Id for floatingRatesReferenceRate => ' + data.floatingRatesReferenceRate + '!');
                    }
                }

                if (data.floatingRatesSpreadRate !== undefined && isNaN(Number(data.floatingRatesSpreadRate))) {
                    return callback({}, null, 'floatingRatesSpreadRate should have a valid numeric value!');
                }

                if (data.interestLookBackPeriod !== undefined && isNaN(Number(data.interestLookBackPeriod))) {
                    return callback({}, null, 'interestLookBackPeriod should have a valid numeric value!');
                }

                if (data.interestMultiplierFactor !== undefined && isNaN(Number(data.interestMultiplierFactor))) {
                    return callback({}, null, 'interestMultiplierFactor should have a valid numeric value!');
                }

                if (data.defaultFixingDate !== undefined && !moment(data.defaultFixingDate).isValid()) {
                    return callback({}, null, 'Invalid Date in defaultFixingDate!');
                } else if (data.defaultFixingDate !== undefined && moment(data.issueDate).isValid()) {
                    data.defaultFixingDate = new Date(moment(data.defaultFixingDate).format());
                }

                if (data.defaultFixingRate !== undefined && isNaN(Number(data.defaultFixingRate))) {
                    return callback({}, null, 'defaultFixingRate should have a valid numeric value!');
                }

                if (data.fixingTerm !== undefined && isNaN(Number(data.fixingTerm))) {
                    return callback({}, null, 'fixingTerm should have a valid numeric value!');
                }

                if (data.fixingUnits !== undefined && !helper.isObjectContainsKey(helper.sysConst.acPeriodUnit, data.fixingUnits)) {
                    return callback({}, null, 'Invalid Data in fixingUnits!');
                }

                if (!helper.isValidObjectId(data.rateResetHolidayCalender)) {
                    return callback({}, null, 'rateResetHolidayCalender is not a valid Calender Or Bank Holiday Id!');
                } else {
                    const itemDetails = await CalenderOrBankHolidayModel
                        .find({_id: data.rateResetHolidayCalender, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback({}, null, 'Invalid Calender Or Bank Holiday Id for rateResetHolidayCalender => ' + data.rateResetHolidayCalender + '!');
                    }
                }

                if (data.compoundingConvention !== undefined && !helper.isObjectContainsKey(helper.sysConst.compoundingConvention, data.compoundingConvention)) {
                    return callback({}, null, 'Invalid Data in compoundingConvention!');
                }

                if (data.spreadConventionOrCompounding !== undefined && !helper.isObjectContainsKey(helper.sysConst.spreadConventionOrCompounding, data.spreadConventionOrCompounding)) {
                    return callback({}, null, 'Invalid Data in spreadConventionOrCompounding!');
                }

                if (data.couponRateMinimum !== undefined && isNaN(Number(data.couponRateMinimum))) {
                    return callback({}, null, 'couponRateMinimum should have a valid numeric value!');
                }

                if (data.couponRateMaximum !== undefined && isNaN(Number(data.couponRateMaximum))) {
                    return callback({}, null, 'couponRateMaximum should have a valid numeric value!');
                }

                callback(null, data, 'All data validated');
            }
        });
    },
    alternativeSecurityIdValidator: (inputData, callback) => {
        const v = new Validator(inputData, {
            alternativeSecurityIdIdentificationSystem: 'string',
            alternativeSecurityIdLongSecurityName: 'string',
            alternativeSecurityIdCusip: 'required|string',
            alternativeSecurityIdIsin: 'string',
        });

        v.check().then(async (matched) => {
            if (!matched) {
                callback(v.errors, null, 'Missing required fields');
            } else {
                let data = {
                    alternativeSecurityIdIdentificationSystem: inputData.alternativeSecurityIdIdentificationSystem !== undefined
                        ? inputData.alternativeSecurityIdIdentificationSystem : '',
                    alternativeSecurityIdLongSecurityName: inputData.alternativeSecurityIdLongSecurityName !== undefined
                        ? inputData.alternativeSecurityIdLongSecurityName : '',
                    alternativeSecurityIdCusip: inputData.alternativeSecurityIdCusip,
                    alternativeSecurityIdIsin: inputData.alternativeSecurityIdIsin !== undefined
                        ? inputData.alternativeSecurityIdIsin : '',
                };

                callback(null, data, 'All data validated');
            }
        });
    },
    putCallValidator: (inputData, callback) => {
        const v = new Validator(inputData, {
            putCalls: 'array'
        });

        v.check().then(async (matched) => {
            if (!matched) {
                callback(v.errors, null, 'Missing required fields');
            } else {
                let data = {
                    putCalls: inputData.putCalls !== undefined ? inputData.putCalls : []
                };

                if (!Array.isArray(data.putCalls)) {
                    return callback({}, null, 'putCalls should be and formatted array!');
                } else {
                    let allPutCalls = [];

                    data.putCalls.forEach((item, index) => {
                        if (moment(item.formDate).isValid()
                            && moment(item.toDate).isValid()
                            && Number(item.price) > 0
                            && Number(item.noOfDays)
                            && helper.isObjectContainsKey(helper.sysConst.putCall, item.optionType)) {
                            allPutCalls.push({
                                formDate: new Date(moment(item.fromDate).format()),
                                toDate: new Date(moment(item.toDate).format()),
                                price: Number(item.price),
                                noOfDays: Number(item.noOfDays),
                                optionType: item.optionType
                            });
                        } else {
                            logger.error(`Skipped onValidate Bond callPuts data: #${index} data failed! => ${JSON.stringify(item)}`);
                        }
                    });

                    data.putCalls = allPutCalls;
                }

                callback(null, data, 'All data validated');
            }
        });
    },
    clientSpecificFieldsValidator: (inputData, callback) => {
        const v = new Validator(inputData, {
            clientSpecificFields: 'array',
        });

        v.check().then(async (matched) => {
            if (!matched) {
                callback(v.errors, null, 'Missing required fields');
            } else {
                let data = {
                    clientSpecificFields: inputData.clientSpecificFields !== undefined
                        ? inputData.clientSpecificFields : []
                };

                if (!Array.isArray(data.clientSpecificFields)) {
                    return callback({}, null, 'putCalls should be and formatted array!');
                } else {
                    let allFields = [];

                    data.putCalls.forEach((item, index) => {
                        if (item.name !== undefined
                            && item.value !== undefined) {
                            allFields.push({
                                name: item.name.toString(),
                                value: item.value
                            });
                        } else {
                            logger.error(`Skipped onValidate Bond client specific fields data: #${index} data failed! => ${JSON.stringify(item)}`);
                        }
                    });

                    data.clientSpecificFields = allFields;
                }

                callback(null, data, 'All data validated');
            }
        });
    },
    commentAndAttachmentValidator: (inputData, callback) => {
        const v = new Validator(inputData, {
            comments: 'string'
        });

        v.check().then(async (matched) => {
            if (!matched) {
                callback(v.errors, null, 'Missing required fields');
            } else {
                let data = {
                    comments: inputData.comments !== undefined ? inputData.comments.toString() : '',
                };

                callback(null, data, 'All data validated');
            }
        });
    },
    removeAttachmentValidator: (inputData, callback) => {
        const v = new Validator(inputData, {
            url: 'required|string'
        });

        v.check().then(async (matched) => {
            if (!matched) {
                callback(v.errors, null, 'Missing required fields');
            } else {
                let data = {
                    url: inputData.url,
                };

                callback(null, data, 'All data validated');
            }
        });
    }
};

let bondDataUpdate = {
    createBond: async (req, data, session, needToCommit, callback) => {
        try {

            const configFind = await BondSecurityModel.find({
                securityId: data.securityId,
                userDefinedSecurityId: data.userDefinedSecurityId,
                name: data.name,
                securityCode: data.securityCode,
                currency: data.currency,
                paymentHolidayCalender: data.paymentHolidayCalender,
                exchange: data.exchange,
                quoted: data.quoted
            }).populate(['securityCode', 'currency', 'paymentHolidayCalender', 'exchange', 'quoted']);

            if (configFind.length > 0) {
                return callback({}, null, 'Bond Security is already '
                    + 'present with Security Id => `'
                    + configFind[0].securityId
                    + '` and User Defined Security Id => `'
                    + configFind[0].userDefinedSecurityId
                    + '` and Name => `'
                    + configFind[0].name
                    + '` and Security Group => `'
                    + configFind[0].securityCode.securityCode
                    + '` and Ib Currency => `'
                    + configFind[0].currency
                    + '` and Bank Holiday => `'
                    + configFind[0].paymentHolidayCalender
                    + '` and Ib Exchange => `'
                    + configFind[0].exchange
                    + '` and Ib Quote => `'
                    + configFind[0].quoted + ' !',
                    {});
            }

            const ib = new BondSecurityModel({
                securityId: data.securityId,
                ISIN: data.ISIN,
                userDefinedSecurityId: data.userDefinedSecurityId,
                name: data.name,
                securityCode: data.securityCode,
                currency: data.currency,
                paymentHolidayCalender: data.paymentHolidayCalender,
                exchange: data.exchange,
                quoted: data.quoted,
                minTradeVolume: data.minTradeVolume,
                volume: data.volume,
                issuer: data.issuer,
                issueDate: data.issueDate,
                issuePrice: data.issuePrice,
                redemptionPrice: data.redemptionPrice,
                redemptionCurrency: data.redemptionCurrency,
                interestType: data.interestType,
                couponRate: data.couponRate,
                maturityDate: data.maturityDate,
                structure: data.structure,
                firstRedemptionDate: data.firstRedemptionDate,
                couponTerm: data.couponTerm,
                couponTermUnit: data.couponTermUnit,
                redemptionTerm: data.redemptionTerm,
                redemptionTermUnit: data.redemptionTermUnit,
                inceptionRedemptionRate: data.inceptionRedemptionRate,
                currentPoolFactor: data.currentPoolFactor,
                firstCouponPaymentDate: data.firstCouponPaymentDate,
                createdByUser: req.appCurrentUserData._id,
            }, {session: session});
            await ib.save();

            const auditData = new BondSecurityAuditModel({
                securityId: ib.securityId,
                ISIN: ib.ISIN,
                userDefinedSecurityId: ib.userDefinedSecurityId,
                name: ib.name,
                securityCode: ib.securityCode,
                currency: ib.currency,
                paymentHolidayCalender: ib.paymentHolidayCalender,
                exchange: ib.exchange,
                quoted: ib.quoted,
                minTradeVolume: ib.minTradeVolume,
                volume: ib.volume,
                issuer: ib.issuer,
                issueDate: ib.issueDate,
                issuePrice: ib.issuePrice,
                redemptionPrice: ib.redemptionPrice,
                redemptionCurrency: ib.redemptionCurrency,
                interestType: ib.interestType,
                couponRate: ib.couponRate,
                maturityDate: ib.maturityDate,
                structure: ib.structure,
                firstRedemptionDate: ib.firstRedemptionDate,
                couponTerm: ib.couponTerm,
                couponTermUnit: ib.couponTermUnit,
                redemptionTerm: ib.redemptionTerm,
                redemptionTermUnit: ib.redemptionTermUnit,
                inceptionRedemptionRate: ib.inceptionRedemptionRate,
                currentPoolFactor: ib.currentPoolFactor,
                firstCouponPaymentDate: ib.firstCouponPaymentDate,
                quotation: ib.quotation,
                settlementDays: ib.settlementDays,
                quoteType: ib.quoteType,
                quotingLotSize: ib.quotingLotSize,
                quotingFaceValue: ib.quotingFaceValue,
                couponConventionDayCount: ib.couponConventionDayCount,
                couponConventionPaymentDayConvention: ib.couponConventionPaymentDayConvention,
                couponConventionTreasuryTermCoupon: ib.couponConventionTreasuryTermCoupon,
                couponConventionEndOfMonthConvention: ib.couponConventionEndOfMonthConvention,
                couponConventionTreasuryTermCouponBase: ib.couponConventionTreasuryTermCouponBase,
                couponConventionHolidayAdjustedCouponFlag: ib.couponConventionHolidayAdjustedCouponFlag,
                couponConventionPaymentType: ib.couponConventionPaymentType,
                couponConventionFixedRateDeCompounding: ib.couponConventionFixedRateDeCompounding,
                couponConventionInclExclOneDay: ib.couponConventionInclExclOneDay,
                couponConventionSequenceConvention: ib.couponConventionSequenceConvention,
                oddCouponsAndRedempOddConvLastCoupon: ib.oddCouponsAndRedempOddConvLastCoupon,
                oddCouponsAndRedempOddConvLastRedeption: ib.oddCouponsAndRedempOddConvLastRedeption,
                sequenceConventionRedemption: ib.sequenceConventionRedemption,
                couponConventionsDayCount: ib.couponConventionsDayCount,
                accruedInterestConventionsInterestType: ib.accruedInterestConventionsInterestType,
                accruedInterestConventionsTreasuryProduct: ib.accruedInterestConventionsTreasuryProduct,
                accruedInterestConventionsDayCountConvention: ib.accruedInterestConventionsDayCountConvention,
                accruedInterestConventionsCalculationMethod: ib.accruedInterestConventionsCalculationMethod,
                floatingRatesReferenceRate: ib.floatingRatesReferenceRate,
                floatingRatesSpreadRate: ib.floatingRatesSpreadRate,
                interestLookBackPeriod: ib.interestLookBackPeriod,
                interestMultiplierFactor: ib.interestMultiplierFactor,
                interestAdjustmentFixingDays: ib.interestAdjustmentFixingDays,
                defaultFixingDate: ib.defaultFixingDate,
                defaultFixingRate: ib.defaultFixingRate,
                fixingTerm: ib.fixingTerm,
                fixingUnits: ib.fixingUnits,
                rateResetHolidayCalender: ib.rateResetHolidayCalender,
                compoundingConvention: ib.compoundingConvention,
                spreadConventionOrCompounding: ib.spreadConventionOrCompounding,
                couponRateMinimum: ib.couponRateMinimum,
                couponRateMaximum: ib.couponRateMaximum,
                alternativeSecurityIdIdentificationSystem: ib.alternativeSecurityIdIdentificationSystem,
                alternativeSecurityIdLongSecurityName: ib.alternativeSecurityIdLongSecurityName,
                alternativeSecurityIdCusip: ib.alternativeSecurityIdCusip,
                alternativeSecurityIdIsin: ib.alternativeSecurityIdIsin,
                putCalls: ib.putCalls,
                clientSpecificFields: ib.clientSpecificFields,
                attachments: ib.attachments,
                comments: ib.comments,
                changedByUser: ib.changedByUser,
                changedDate: ib.changedDate,
                createdByUser: ib.createdByUser,
                isDeleted: ib.isDeleted,
                deletedBy: ib.deletedBy,
                deleteReason: ib.deleteReason,
                actionItemId: ib._id,
                action: helper.sysConst.permissionAccessTypes.CREATE,
                actionDate: new Date(),
                actionBy: req.appCurrentUserData._id,
            }, {session: session});
            await auditData.save();

            if (needToCommit) {
                await session.commitTransaction();
            }
            callback(null, ib, 'Bond Security General Info added successfully!');
        } catch (e) {
            await session.abortTransaction();
            callback(e, null, 'Server Error!');
        }
    },
    updateBondGeneral: async (req, data, session, needToCommit, callback) => {
        try {
            let id = req.validParamId;

            let configItem = await BondSecurityModel.find({_id: id, isDeleted: false});

            if (configItem.length === 0) {
                return callback({notFound: true}, null, `Bond Security with id => ${id} not found or deleted!`);
            }

            const configFind = await BondSecurityModel.find({
                securityId: data.securityId,
                userDefinedSecurityId: data.userDefinedSecurityId,
                name: data.name,
                securityCode: data.securityCode,
                currency: data.currency,
                paymentHolidayCalender: data.paymentHolidayCalender,
                exchange: data.exchange,
                quoted: data.quoted
            }).populate(['securityCode', 'currency', 'paymentHolidayCalender', 'exchange', 'quoted']);

            if (configFind.length > 0) {
                return callback(false, 'Bond Security is already '
                    + 'present with Security Id => `'
                    + configFind[0].securityId
                    + '` and User Defined Security Id => `'
                    + configFind[0].userDefinedSecurityId
                    + '` and Name => `'
                    + configFind[0].name
                    + '` and Security Group => `'
                    + configFind[0].securityCode.securityCode
                    + '` and Ib Currency => `'
                    + configFind[0].currency
                    + '` and Bank Holiday => `'
                    + configFind[0].paymentHolidayCalender
                    + '` and Ib Exchange => `'
                    + configFind[0].exchange
                    + '` and Ib Quote => `'
                    + configFind[0].quoted + ' !',
                    {});
            }

            data.changedByUser = req.appCurrentUserData._id;
            data.changedDate = new Date();

            await BondSecurityModel.updateOne({_id: id}, data).session(session);

            let configItemDetails = await BondSecurityModel.find({_id: id, isDeleted: false}).session(session);
            configItemDetails = configItemDetails[0];

            const auditData = new BondSecurityAuditModel({
                securityId: configItemDetails.securityId,
                ISIN: configItemDetails.ISIN,
                userDefinedSecurityId: configItemDetails.userDefinedSecurityId,
                name: configItemDetails.name,
                securityCode: configItemDetails.securityCode,
                currency: configItemDetails.currency,
                paymentHolidayCalender: configItemDetails.paymentHolidayCalender,
                exchange: configItemDetails.exchange,
                quoted: configItemDetails.quoted,
                minTradeVolume: configItemDetails.minTradeVolume,
                volume: configItemDetails.volume,
                issuer: configItemDetails.issuer,
                issueDate: configItemDetails.issueDate,
                issuePrice: configItemDetails.issuePrice,
                redemptionPrice: configItemDetails.redemptionPrice,
                redemptionCurrency: configItemDetails.redemptionCurrency,
                interestType: configItemDetails.interestType,
                couponRate: configItemDetails.couponRate,
                maturityDate: configItemDetails.maturityDate,
                structure: configItemDetails.structure,
                firstRedemptionDate: configItemDetails.firstRedemptionDate,
                couponTerm: configItemDetails.couponTerm,
                couponTermUnit: configItemDetails.couponTermUnit,
                redemptionTerm: configItemDetails.redemptionTerm,
                redemptionTermUnit: configItemDetails.redemptionTermUnit,
                inceptionRedemptionRate: configItemDetails.inceptionRedemptionRate,
                currentPoolFactor: configItemDetails.currentPoolFactor,
                firstCouponPaymentDate: configItemDetails.firstCouponPaymentDate,
                quotation: configItemDetails.quotation,
                settlementDays: configItemDetails.settlementDays,
                quoteType: configItemDetails.quoteType,
                quotingLotSize: configItemDetails.quotingLotSize,
                quotingFaceValue: configItemDetails.quotingFaceValue,
                couponConventionDayCount: configItemDetails.couponConventionDayCount,
                couponConventionPaymentDayConvention: configItemDetails.couponConventionPaymentDayConvention,
                couponConventionTreasuryTermCoupon: configItemDetails.couponConventionTreasuryTermCoupon,
                couponConventionEndOfMonthConvention: configItemDetails.couponConventionEndOfMonthConvention,
                couponConventionTreasuryTermCouponBase: configItemDetails.couponConventionTreasuryTermCouponBase,
                couponConventionHolidayAdjustedCouponFlag: configItemDetails.couponConventionHolidayAdjustedCouponFlag,
                couponConventionPaymentType: configItemDetails.couponConventionPaymentType,
                couponConventionFixedRateDeCompounding: configItemDetails.couponConventionFixedRateDeCompounding,
                couponConventionInclExclOneDay: configItemDetails.couponConventionInclExclOneDay,
                couponConventionSequenceConvention: configItemDetails.couponConventionSequenceConvention,
                oddCouponsAndRedempOddConvLastCoupon: configItemDetails.oddCouponsAndRedempOddConvLastCoupon,
                oddCouponsAndRedempOddConvLastRedeption: configItemDetails.oddCouponsAndRedempOddConvLastRedeption,
                sequenceConventionRedemption: configItemDetails.sequenceConventionRedemption,
                couponConventionsDayCount: configItemDetails.couponConventionsDayCount,
                accruedInterestConventionsInterestType: configItemDetails.accruedInterestConventionsInterestType,
                accruedInterestConventionsTreasuryProduct: configItemDetails.accruedInterestConventionsTreasuryProduct,
                accruedInterestConventionsDayCountConvention: configItemDetails.accruedInterestConventionsDayCountConvention,
                accruedInterestConventionsCalculationMethod: configItemDetails.accruedInterestConventionsCalculationMethod,
                floatingRatesReferenceRate: configItemDetails.floatingRatesReferenceRate,
                floatingRatesSpreadRate: configItemDetails.floatingRatesSpreadRate,
                interestLookBackPeriod: configItemDetails.interestLookBackPeriod,
                interestMultiplierFactor: configItemDetails.interestMultiplierFactor,
                interestAdjustmentFixingDays: configItemDetails.interestAdjustmentFixingDays,
                defaultFixingDate: configItemDetails.defaultFixingDate,
                defaultFixingRate: configItemDetails.defaultFixingRate,
                fixingTerm: configItemDetails.fixingTerm,
                fixingUnits: configItemDetails.fixingUnits,
                rateResetHolidayCalender: configItemDetails.rateResetHolidayCalender,
                compoundingConvention: configItemDetails.compoundingConvention,
                spreadConventionOrCompounding: configItemDetails.spreadConventionOrCompounding,
                couponRateMinimum: configItemDetails.couponRateMinimum,
                couponRateMaximum: configItemDetails.couponRateMaximum,
                alternativeSecurityIdIdentificationSystem: configItemDetails.alternativeSecurityIdIdentificationSystem,
                alternativeSecurityIdLongSecurityName: configItemDetails.alternativeSecurityIdLongSecurityName,
                alternativeSecurityIdCusip: configItemDetails.alternativeSecurityIdCusip,
                alternativeSecurityIdIsin: configItemDetails.alternativeSecurityIdIsin,
                putCalls: configItemDetails.putCalls,
                clientSpecificFields: configItemDetails.clientSpecificFields,
                attachments: configItemDetails.attachments,
                comments: configItemDetails.comments,
                changedByUser: configItemDetails.changedByUser,
                changedDate: configItemDetails.changedDate,
                createdByUser: configItemDetails.createdByUser,
                isDeleted: configItemDetails.isDeleted,
                deletedBy: configItemDetails.deletedBy,
                deleteReason: configItemDetails.deleteReason,
                actionItemId: configItemDetails._id,
                action: helper.sysConst.permissionAccessTypes.EDIT,
                actionDate: new Date(),
                actionBy: req.appCurrentUserData._id,
            }, {session: session});
            await auditData.save();

            callback(null, {}, 'Bond Security General Info updated successfully!');
        } catch (e) {
            await session.abortTransaction();
            callback(e, null, 'Server Error!');
        }
    },
    updateMarketConvention: async (req, data, session, needToCommit, callback) => {
        try {
            let id = req.validParamId;

            let configItem = await BondSecurityModel.find({_id: id, isDeleted: false});

            if (configItem.length === 0) {
                await session.abortTransaction();
                return callback({notFound: true}, null, `Bond Security with id => ${id} not found or deleted!`);
            }

            data.changedByUser = req.appCurrentUserData._id;
            data.changedDate = new Date();

            await BondSecurityModel.updateOne({_id: id}, data).session(session);

            let configItemDetails = await BondSecurityModel.find({_id: id, isDeleted: false}).session(session);
            configItemDetails = configItemDetails[0];

            const auditData = new BondSecurityAuditModel({
                securityId: configItemDetails.securityId,
                ISIN: configItemDetails.ISIN,
                userDefinedSecurityId: configItemDetails.userDefinedSecurityId,
                name: configItemDetails.name,
                securityCode: configItemDetails.securityCode,
                currency: configItemDetails.currency,
                paymentHolidayCalender: configItemDetails.paymentHolidayCalender,
                exchange: configItemDetails.exchange,
                quoted: configItemDetails.quoted,
                minTradeVolume: configItemDetails.minTradeVolume,
                volume: configItemDetails.volume,
                issuer: configItemDetails.issuer,
                issueDate: configItemDetails.issueDate,
                issuePrice: configItemDetails.issuePrice,
                redemptionPrice: configItemDetails.redemptionPrice,
                redemptionCurrency: configItemDetails.redemptionCurrency,
                interestType: configItemDetails.interestType,
                couponRate: configItemDetails.couponRate,
                maturityDate: configItemDetails.maturityDate,
                structure: configItemDetails.structure,
                firstRedemptionDate: configItemDetails.firstRedemptionDate,
                couponTerm: configItemDetails.couponTerm,
                couponTermUnit: configItemDetails.couponTermUnit,
                redemptionTerm: configItemDetails.redemptionTerm,
                redemptionTermUnit: configItemDetails.redemptionTermUnit,
                inceptionRedemptionRate: configItemDetails.inceptionRedemptionRate,
                currentPoolFactor: configItemDetails.currentPoolFactor,
                firstCouponPaymentDate: configItemDetails.firstCouponPaymentDate,
                quotation: configItemDetails.quotation,
                settlementDays: configItemDetails.settlementDays,
                quoteType: configItemDetails.quoteType,
                quotingLotSize: configItemDetails.quotingLotSize,
                quotingFaceValue: configItemDetails.quotingFaceValue,
                couponConventionDayCount: configItemDetails.couponConventionDayCount,
                couponConventionPaymentDayConvention: configItemDetails.couponConventionPaymentDayConvention,
                couponConventionTreasuryTermCoupon: configItemDetails.couponConventionTreasuryTermCoupon,
                couponConventionEndOfMonthConvention: configItemDetails.couponConventionEndOfMonthConvention,
                couponConventionTreasuryTermCouponBase: configItemDetails.couponConventionTreasuryTermCouponBase,
                couponConventionHolidayAdjustedCouponFlag: configItemDetails.couponConventionHolidayAdjustedCouponFlag,
                couponConventionPaymentType: configItemDetails.couponConventionPaymentType,
                couponConventionFixedRateDeCompounding: configItemDetails.couponConventionFixedRateDeCompounding,
                couponConventionInclExclOneDay: configItemDetails.couponConventionInclExclOneDay,
                couponConventionSequenceConvention: configItemDetails.couponConventionSequenceConvention,
                oddCouponsAndRedempOddConvLastCoupon: configItemDetails.oddCouponsAndRedempOddConvLastCoupon,
                oddCouponsAndRedempOddConvLastRedeption: configItemDetails.oddCouponsAndRedempOddConvLastRedeption,
                sequenceConventionRedemption: configItemDetails.sequenceConventionRedemption,
                couponConventionsDayCount: configItemDetails.couponConventionsDayCount,
                accruedInterestConventionsInterestType: configItemDetails.accruedInterestConventionsInterestType,
                accruedInterestConventionsTreasuryProduct: configItemDetails.accruedInterestConventionsTreasuryProduct,
                accruedInterestConventionsDayCountConvention: configItemDetails.accruedInterestConventionsDayCountConvention,
                accruedInterestConventionsCalculationMethod: configItemDetails.accruedInterestConventionsCalculationMethod,
                floatingRatesReferenceRate: configItemDetails.floatingRatesReferenceRate,
                floatingRatesSpreadRate: configItemDetails.floatingRatesSpreadRate,
                interestLookBackPeriod: configItemDetails.interestLookBackPeriod,
                interestMultiplierFactor: configItemDetails.interestMultiplierFactor,
                interestAdjustmentFixingDays: configItemDetails.interestAdjustmentFixingDays,
                defaultFixingDate: configItemDetails.defaultFixingDate,
                defaultFixingRate: configItemDetails.defaultFixingRate,
                fixingTerm: configItemDetails.fixingTerm,
                fixingUnits: configItemDetails.fixingUnits,
                rateResetHolidayCalender: configItemDetails.rateResetHolidayCalender,
                compoundingConvention: configItemDetails.compoundingConvention,
                spreadConventionOrCompounding: configItemDetails.spreadConventionOrCompounding,
                couponRateMinimum: configItemDetails.couponRateMinimum,
                couponRateMaximum: configItemDetails.couponRateMaximum,
                alternativeSecurityIdIdentificationSystem: configItemDetails.alternativeSecurityIdIdentificationSystem,
                alternativeSecurityIdLongSecurityName: configItemDetails.alternativeSecurityIdLongSecurityName,
                alternativeSecurityIdCusip: configItemDetails.alternativeSecurityIdCusip,
                alternativeSecurityIdIsin: configItemDetails.alternativeSecurityIdIsin,
                putCalls: configItemDetails.putCalls,
                clientSpecificFields: configItemDetails.clientSpecificFields,
                attachments: configItemDetails.attachments,
                comments: configItemDetails.comments,
                changedByUser: configItemDetails.changedByUser,
                changedDate: configItemDetails.changedDate,
                createdByUser: configItemDetails.createdByUser,
                isDeleted: configItemDetails.isDeleted,
                deletedBy: configItemDetails.deletedBy,
                deleteReason: configItemDetails.deleteReason,
                actionItemId: configItemDetails._id,
                action: helper.sysConst.permissionAccessTypes.EDIT,
                actionDate: new Date(),
                actionBy: req.appCurrentUserData._id,
            }, {session: session});
            await auditData.save();

            if (needToCommit) {
                await session.commitTransaction();
            }
            callback(null, {}, 'Bond Marker Conversion Info updated successfully!');
        } catch (e) {
            console.log('in catch section => trying to abort session!', e);
            await session.abortTransaction();
            callback(e, null, e.message);
        }
    },
    updateReferenceRate: async (req, data, session, needToCommit, callback) => {
        try {
            let id = req.validParamId;

            let configItem = await BondSecurityModel.find({_id: id, isDeleted: false});

            if (configItem.length === 0) {
                return callback({notFound: true}, null, `Bond Security with id => ${id} not found or deleted!`);
            }

            data.changedByUser = req.appCurrentUserData._id;
            data.changedDate = new Date();

            await BondSecurityModel.updateOne({_id: id}, data).session(session);

            let configItemDetails = await BondSecurityModel.find({_id: id, isDeleted: false}).session(session);
            configItemDetails = configItemDetails[0];

            const auditData = new BondSecurityAuditModel({
                securityId: configItemDetails.securityId,
                ISIN: configItemDetails.ISIN,
                userDefinedSecurityId: configItemDetails.userDefinedSecurityId,
                name: configItemDetails.name,
                securityCode: configItemDetails.securityCode,
                currency: configItemDetails.currency,
                paymentHolidayCalender: configItemDetails.paymentHolidayCalender,
                exchange: configItemDetails.exchange,
                quoted: configItemDetails.quoted,
                minTradeVolume: configItemDetails.minTradeVolume,
                volume: configItemDetails.volume,
                issuer: configItemDetails.issuer,
                issueDate: configItemDetails.issueDate,
                issuePrice: configItemDetails.issuePrice,
                redemptionPrice: configItemDetails.redemptionPrice,
                redemptionCurrency: configItemDetails.redemptionCurrency,
                interestType: configItemDetails.interestType,
                couponRate: configItemDetails.couponRate,
                maturityDate: configItemDetails.maturityDate,
                structure: configItemDetails.structure,
                firstRedemptionDate: configItemDetails.firstRedemptionDate,
                couponTerm: configItemDetails.couponTerm,
                couponTermUnit: configItemDetails.couponTermUnit,
                redemptionTerm: configItemDetails.redemptionTerm,
                redemptionTermUnit: configItemDetails.redemptionTermUnit,
                inceptionRedemptionRate: configItemDetails.inceptionRedemptionRate,
                currentPoolFactor: configItemDetails.currentPoolFactor,
                firstCouponPaymentDate: configItemDetails.firstCouponPaymentDate,
                quotation: configItemDetails.quotation,
                settlementDays: configItemDetails.settlementDays,
                quoteType: configItemDetails.quoteType,
                quotingLotSize: configItemDetails.quotingLotSize,
                quotingFaceValue: configItemDetails.quotingFaceValue,
                couponConventionDayCount: configItemDetails.couponConventionDayCount,
                couponConventionPaymentDayConvention: configItemDetails.couponConventionPaymentDayConvention,
                couponConventionTreasuryTermCoupon: configItemDetails.couponConventionTreasuryTermCoupon,
                couponConventionEndOfMonthConvention: configItemDetails.couponConventionEndOfMonthConvention,
                couponConventionTreasuryTermCouponBase: configItemDetails.couponConventionTreasuryTermCouponBase,
                couponConventionHolidayAdjustedCouponFlag: configItemDetails.couponConventionHolidayAdjustedCouponFlag,
                couponConventionPaymentType: configItemDetails.couponConventionPaymentType,
                couponConventionFixedRateDeCompounding: configItemDetails.couponConventionFixedRateDeCompounding,
                couponConventionInclExclOneDay: configItemDetails.couponConventionInclExclOneDay,
                couponConventionSequenceConvention: configItemDetails.couponConventionSequenceConvention,
                oddCouponsAndRedempOddConvLastCoupon: configItemDetails.oddCouponsAndRedempOddConvLastCoupon,
                oddCouponsAndRedempOddConvLastRedeption: configItemDetails.oddCouponsAndRedempOddConvLastRedeption,
                sequenceConventionRedemption: configItemDetails.sequenceConventionRedemption,
                couponConventionsDayCount: configItemDetails.couponConventionsDayCount,
                accruedInterestConventionsInterestType: configItemDetails.accruedInterestConventionsInterestType,
                accruedInterestConventionsTreasuryProduct: configItemDetails.accruedInterestConventionsTreasuryProduct,
                accruedInterestConventionsDayCountConvention: configItemDetails.accruedInterestConventionsDayCountConvention,
                accruedInterestConventionsCalculationMethod: configItemDetails.accruedInterestConventionsCalculationMethod,
                floatingRatesReferenceRate: configItemDetails.floatingRatesReferenceRate,
                floatingRatesSpreadRate: configItemDetails.floatingRatesSpreadRate,
                interestLookBackPeriod: configItemDetails.interestLookBackPeriod,
                interestMultiplierFactor: configItemDetails.interestMultiplierFactor,
                interestAdjustmentFixingDays: configItemDetails.interestAdjustmentFixingDays,
                defaultFixingDate: configItemDetails.defaultFixingDate,
                defaultFixingRate: configItemDetails.defaultFixingRate,
                fixingTerm: configItemDetails.fixingTerm,
                fixingUnits: configItemDetails.fixingUnits,
                rateResetHolidayCalender: configItemDetails.rateResetHolidayCalender,
                compoundingConvention: configItemDetails.compoundingConvention,
                spreadConventionOrCompounding: configItemDetails.spreadConventionOrCompounding,
                couponRateMinimum: configItemDetails.couponRateMinimum,
                couponRateMaximum: configItemDetails.couponRateMaximum,
                alternativeSecurityIdIdentificationSystem: configItemDetails.alternativeSecurityIdIdentificationSystem,
                alternativeSecurityIdLongSecurityName: configItemDetails.alternativeSecurityIdLongSecurityName,
                alternativeSecurityIdCusip: configItemDetails.alternativeSecurityIdCusip,
                alternativeSecurityIdIsin: configItemDetails.alternativeSecurityIdIsin,
                putCalls: configItemDetails.putCalls,
                clientSpecificFields: configItemDetails.clientSpecificFields,
                attachments: configItemDetails.attachments,
                comments: configItemDetails.comments,
                changedByUser: configItemDetails.changedByUser,
                changedDate: configItemDetails.changedDate,
                createdByUser: configItemDetails.createdByUser,
                isDeleted: configItemDetails.isDeleted,
                deletedBy: configItemDetails.deletedBy,
                deleteReason: configItemDetails.deleteReason,
                actionItemId: configItemDetails._id,
                action: helper.sysConst.permissionAccessTypes.EDIT,
                actionDate: new Date(),
                actionBy: req.appCurrentUserData._id,
            }, {session: session});
            await auditData.save();

            if (needToCommit) {
                await session.commitTransaction();
            }
            callback(null, {}, 'Bond Reference rate Info updated successfully!');
        } catch (e) {
            await session.abortTransaction();
            callback(e, null, 'Server Error!');
        }
    },
    updateAlternativeSecurityId: async (req, data, session, needToCommit, callback) => {
        try {
            let id = req.validParamId;

            let configItem = await BondSecurityModel.find({_id: id, isDeleted: false});

            if (configItem.length === 0) {
                return callback({notFound: true}, null, `Bond Security with id => ${id} not found or deleted!`);
            }

            data.changedByUser = req.appCurrentUserData._id;
            data.changedDate = new Date();

            await BondSecurityModel.updateOne({_id: id}, data).session(session);

            let configItemDetails = await BondSecurityModel.find({_id: id, isDeleted: false}).session(session);
            configItemDetails = configItemDetails[0];

            const auditData = new BondSecurityAuditModel({
                securityId: configItemDetails.securityId,
                ISIN: configItemDetails.ISIN,
                userDefinedSecurityId: configItemDetails.userDefinedSecurityId,
                name: configItemDetails.name,
                securityCode: configItemDetails.securityCode,
                currency: configItemDetails.currency,
                paymentHolidayCalender: configItemDetails.paymentHolidayCalender,
                exchange: configItemDetails.exchange,
                quoted: configItemDetails.quoted,
                minTradeVolume: configItemDetails.minTradeVolume,
                volume: configItemDetails.volume,
                issuer: configItemDetails.issuer,
                issueDate: configItemDetails.issueDate,
                issuePrice: configItemDetails.issuePrice,
                redemptionPrice: configItemDetails.redemptionPrice,
                redemptionCurrency: configItemDetails.redemptionCurrency,
                interestType: configItemDetails.interestType,
                couponRate: configItemDetails.couponRate,
                maturityDate: configItemDetails.maturityDate,
                structure: configItemDetails.structure,
                firstRedemptionDate: configItemDetails.firstRedemptionDate,
                couponTerm: configItemDetails.couponTerm,
                couponTermUnit: configItemDetails.couponTermUnit,
                redemptionTerm: configItemDetails.redemptionTerm,
                redemptionTermUnit: configItemDetails.redemptionTermUnit,
                inceptionRedemptionRate: configItemDetails.inceptionRedemptionRate,
                currentPoolFactor: configItemDetails.currentPoolFactor,
                firstCouponPaymentDate: configItemDetails.firstCouponPaymentDate,
                quotation: configItemDetails.quotation,
                settlementDays: configItemDetails.settlementDays,
                quoteType: configItemDetails.quoteType,
                quotingLotSize: configItemDetails.quotingLotSize,
                quotingFaceValue: configItemDetails.quotingFaceValue,
                couponConventionDayCount: configItemDetails.couponConventionDayCount,
                couponConventionPaymentDayConvention: configItemDetails.couponConventionPaymentDayConvention,
                couponConventionTreasuryTermCoupon: configItemDetails.couponConventionTreasuryTermCoupon,
                couponConventionEndOfMonthConvention: configItemDetails.couponConventionEndOfMonthConvention,
                couponConventionTreasuryTermCouponBase: configItemDetails.couponConventionTreasuryTermCouponBase,
                couponConventionHolidayAdjustedCouponFlag: configItemDetails.couponConventionHolidayAdjustedCouponFlag,
                couponConventionPaymentType: configItemDetails.couponConventionPaymentType,
                couponConventionFixedRateDeCompounding: configItemDetails.couponConventionFixedRateDeCompounding,
                couponConventionInclExclOneDay: configItemDetails.couponConventionInclExclOneDay,
                couponConventionSequenceConvention: configItemDetails.couponConventionSequenceConvention,
                oddCouponsAndRedempOddConvLastCoupon: configItemDetails.oddCouponsAndRedempOddConvLastCoupon,
                oddCouponsAndRedempOddConvLastRedeption: configItemDetails.oddCouponsAndRedempOddConvLastRedeption,
                sequenceConventionRedemption: configItemDetails.sequenceConventionRedemption,
                couponConventionsDayCount: configItemDetails.couponConventionsDayCount,
                accruedInterestConventionsInterestType: configItemDetails.accruedInterestConventionsInterestType,
                accruedInterestConventionsTreasuryProduct: configItemDetails.accruedInterestConventionsTreasuryProduct,
                accruedInterestConventionsDayCountConvention: configItemDetails.accruedInterestConventionsDayCountConvention,
                accruedInterestConventionsCalculationMethod: configItemDetails.accruedInterestConventionsCalculationMethod,
                floatingRatesReferenceRate: configItemDetails.floatingRatesReferenceRate,
                floatingRatesSpreadRate: configItemDetails.floatingRatesSpreadRate,
                interestLookBackPeriod: configItemDetails.interestLookBackPeriod,
                interestMultiplierFactor: configItemDetails.interestMultiplierFactor,
                interestAdjustmentFixingDays: configItemDetails.interestAdjustmentFixingDays,
                defaultFixingDate: configItemDetails.defaultFixingDate,
                defaultFixingRate: configItemDetails.defaultFixingRate,
                fixingTerm: configItemDetails.fixingTerm,
                fixingUnits: configItemDetails.fixingUnits,
                rateResetHolidayCalender: configItemDetails.rateResetHolidayCalender,
                compoundingConvention: configItemDetails.compoundingConvention,
                spreadConventionOrCompounding: configItemDetails.spreadConventionOrCompounding,
                couponRateMinimum: configItemDetails.couponRateMinimum,
                couponRateMaximum: configItemDetails.couponRateMaximum,
                alternativeSecurityIdIdentificationSystem: configItemDetails.alternativeSecurityIdIdentificationSystem,
                alternativeSecurityIdLongSecurityName: configItemDetails.alternativeSecurityIdLongSecurityName,
                alternativeSecurityIdCusip: configItemDetails.alternativeSecurityIdCusip,
                alternativeSecurityIdIsin: configItemDetails.alternativeSecurityIdIsin,
                putCalls: configItemDetails.putCalls,
                clientSpecificFields: configItemDetails.clientSpecificFields,
                attachments: configItemDetails.attachments,
                comments: configItemDetails.comments,
                changedByUser: configItemDetails.changedByUser,
                changedDate: configItemDetails.changedDate,
                createdByUser: configItemDetails.createdByUser,
                isDeleted: configItemDetails.isDeleted,
                deletedBy: configItemDetails.deletedBy,
                deleteReason: configItemDetails.deleteReason,
                actionItemId: configItemDetails._id,
                action: helper.sysConst.permissionAccessTypes.EDIT,
                actionDate: new Date(),
                actionBy: req.appCurrentUserData._id,
            }, {session: session});
            await auditData.save();

            if (needToCommit) {
                await session.commitTransaction();
            }
            callback(null, {}, 'Bond Alternative Security Info updated successfully!');
        } catch (e) {
            await session.abortTransaction();
            callback(e, null, 'Server Error!');
        }
    },
    updatePutCall: async (req, data, session, needToCommit, callback) => {
        try {
            let id = req.validParamId;

            let configItem = await BondSecurityModel.find({_id: id, isDeleted: false});

            if (configItem.length === 0) {
                return callback({notFound: true}, null, `Bond Security with id => ${id} not found or deleted!`);
            }

            data.changedByUser = req.appCurrentUserData._id;
            data.changedDate = new Date();

            console.log(data);

            await BondSecurityModel.updateOne({_id: id}, data).session(session);

            let configItemDetails = await BondSecurityModel.find({_id: id, isDeleted: false}).session(session);
            configItemDetails = configItemDetails[0];

            console.log(configItemDetails);

            const auditData = new BondSecurityAuditModel({
                securityId: configItemDetails.securityId,
                ISIN: configItemDetails.ISIN,
                userDefinedSecurityId: configItemDetails.userDefinedSecurityId,
                name: configItemDetails.name,
                securityCode: configItemDetails.securityCode,
                currency: configItemDetails.currency,
                paymentHolidayCalender: configItemDetails.paymentHolidayCalender,
                exchange: configItemDetails.exchange,
                quoted: configItemDetails.quoted,
                minTradeVolume: configItemDetails.minTradeVolume,
                volume: configItemDetails.volume,
                issuer: configItemDetails.issuer,
                issueDate: configItemDetails.issueDate,
                issuePrice: configItemDetails.issuePrice,
                redemptionPrice: configItemDetails.redemptionPrice,
                redemptionCurrency: configItemDetails.redemptionCurrency,
                interestType: configItemDetails.interestType,
                couponRate: configItemDetails.couponRate,
                maturityDate: configItemDetails.maturityDate,
                structure: configItemDetails.structure,
                firstRedemptionDate: configItemDetails.firstRedemptionDate,
                couponTerm: configItemDetails.couponTerm,
                couponTermUnit: configItemDetails.couponTermUnit,
                redemptionTerm: configItemDetails.redemptionTerm,
                redemptionTermUnit: configItemDetails.redemptionTermUnit,
                inceptionRedemptionRate: configItemDetails.inceptionRedemptionRate,
                currentPoolFactor: configItemDetails.currentPoolFactor,
                firstCouponPaymentDate: configItemDetails.firstCouponPaymentDate,
                quotation: configItemDetails.quotation,
                settlementDays: configItemDetails.settlementDays,
                quoteType: configItemDetails.quoteType,
                quotingLotSize: configItemDetails.quotingLotSize,
                quotingFaceValue: configItemDetails.quotingFaceValue,
                couponConventionDayCount: configItemDetails.couponConventionDayCount,
                couponConventionPaymentDayConvention: configItemDetails.couponConventionPaymentDayConvention,
                couponConventionTreasuryTermCoupon: configItemDetails.couponConventionTreasuryTermCoupon,
                couponConventionEndOfMonthConvention: configItemDetails.couponConventionEndOfMonthConvention,
                couponConventionTreasuryTermCouponBase: configItemDetails.couponConventionTreasuryTermCouponBase,
                couponConventionHolidayAdjustedCouponFlag: configItemDetails.couponConventionHolidayAdjustedCouponFlag,
                couponConventionPaymentType: configItemDetails.couponConventionPaymentType,
                couponConventionFixedRateDeCompounding: configItemDetails.couponConventionFixedRateDeCompounding,
                couponConventionInclExclOneDay: configItemDetails.couponConventionInclExclOneDay,
                couponConventionSequenceConvention: configItemDetails.couponConventionSequenceConvention,
                oddCouponsAndRedempOddConvLastCoupon: configItemDetails.oddCouponsAndRedempOddConvLastCoupon,
                oddCouponsAndRedempOddConvLastRedeption: configItemDetails.oddCouponsAndRedempOddConvLastRedeption,
                sequenceConventionRedemption: configItemDetails.sequenceConventionRedemption,
                couponConventionsDayCount: configItemDetails.couponConventionsDayCount,
                accruedInterestConventionsInterestType: configItemDetails.accruedInterestConventionsInterestType,
                accruedInterestConventionsTreasuryProduct: configItemDetails.accruedInterestConventionsTreasuryProduct,
                accruedInterestConventionsDayCountConvention: configItemDetails.accruedInterestConventionsDayCountConvention,
                accruedInterestConventionsCalculationMethod: configItemDetails.accruedInterestConventionsCalculationMethod,
                floatingRatesReferenceRate: configItemDetails.floatingRatesReferenceRate,
                floatingRatesSpreadRate: configItemDetails.floatingRatesSpreadRate,
                interestLookBackPeriod: configItemDetails.interestLookBackPeriod,
                interestMultiplierFactor: configItemDetails.interestMultiplierFactor,
                interestAdjustmentFixingDays: configItemDetails.interestAdjustmentFixingDays,
                defaultFixingDate: configItemDetails.defaultFixingDate,
                defaultFixingRate: configItemDetails.defaultFixingRate,
                fixingTerm: configItemDetails.fixingTerm,
                fixingUnits: configItemDetails.fixingUnits,
                rateResetHolidayCalender: configItemDetails.rateResetHolidayCalender,
                compoundingConvention: configItemDetails.compoundingConvention,
                spreadConventionOrCompounding: configItemDetails.spreadConventionOrCompounding,
                couponRateMinimum: configItemDetails.couponRateMinimum,
                couponRateMaximum: configItemDetails.couponRateMaximum,
                alternativeSecurityIdIdentificationSystem: configItemDetails.alternativeSecurityIdIdentificationSystem,
                alternativeSecurityIdLongSecurityName: configItemDetails.alternativeSecurityIdLongSecurityName,
                alternativeSecurityIdCusip: configItemDetails.alternativeSecurityIdCusip,
                alternativeSecurityIdIsin: configItemDetails.alternativeSecurityIdIsin,
                putCalls: configItemDetails.putCalls,
                clientSpecificFields: configItemDetails.clientSpecificFields,
                attachments: configItemDetails.attachments,
                comments: configItemDetails.comments,
                changedByUser: configItemDetails.changedByUser,
                changedDate: configItemDetails.changedDate,
                createdByUser: configItemDetails.createdByUser,
                isDeleted: configItemDetails.isDeleted,
                deletedBy: configItemDetails.deletedBy,
                deleteReason: configItemDetails.deleteReason,
                actionItemId: configItemDetails._id,
                action: helper.sysConst.permissionAccessTypes.EDIT,
                actionDate: new Date(),
                actionBy: req.appCurrentUserData._id,
            }, {session: session});
            await auditData.save();

            if (needToCommit) {
                await session.commitTransaction();
            }
            callback(null, {}, 'Bond Put Call Info updated successfully!');
        } catch (e) {
            await session.abortTransaction();
            callback(e, null, 'Server Error!');
        }
    },
    updateClientSpecificFields: async (req, data, session, needToCommit, callback) => {
        try {
            let id = req.validParamId;

            let configItem = await BondSecurityModel.find({_id: id, isDeleted: false});

            if (configItem.length === 0) {
                return callback({notFound: true}, null, `Bond Security with id => ${id} not found or deleted!`);
            }

            data.changedByUser = req.appCurrentUserData._id;
            data.changedDate = new Date();

            await BondSecurityModel.updateOne({_id: id}, data).session(session);

            let configItemDetails = await BondSecurityModel.find({_id: id, isDeleted: false}).session(session);
            configItemDetails = configItemDetails[0];

            const auditData = new BondSecurityAuditModel({
                securityId: configItemDetails.securityId,
                ISIN: configItemDetails.ISIN,
                userDefinedSecurityId: configItemDetails.userDefinedSecurityId,
                name: configItemDetails.name,
                securityCode: configItemDetails.securityCode,
                currency: configItemDetails.currency,
                paymentHolidayCalender: configItemDetails.paymentHolidayCalender,
                exchange: configItemDetails.exchange,
                quoted: configItemDetails.quoted,
                minTradeVolume: configItemDetails.minTradeVolume,
                volume: configItemDetails.volume,
                issuer: configItemDetails.issuer,
                issueDate: configItemDetails.issueDate,
                issuePrice: configItemDetails.issuePrice,
                redemptionPrice: configItemDetails.redemptionPrice,
                redemptionCurrency: configItemDetails.redemptionCurrency,
                interestType: configItemDetails.interestType,
                couponRate: configItemDetails.couponRate,
                maturityDate: configItemDetails.maturityDate,
                structure: configItemDetails.structure,
                firstRedemptionDate: configItemDetails.firstRedemptionDate,
                couponTerm: configItemDetails.couponTerm,
                couponTermUnit: configItemDetails.couponTermUnit,
                redemptionTerm: configItemDetails.redemptionTerm,
                redemptionTermUnit: configItemDetails.redemptionTermUnit,
                inceptionRedemptionRate: configItemDetails.inceptionRedemptionRate,
                currentPoolFactor: configItemDetails.currentPoolFactor,
                firstCouponPaymentDate: configItemDetails.firstCouponPaymentDate,
                quotation: configItemDetails.quotation,
                settlementDays: configItemDetails.settlementDays,
                quoteType: configItemDetails.quoteType,
                quotingLotSize: configItemDetails.quotingLotSize,
                quotingFaceValue: configItemDetails.quotingFaceValue,
                couponConventionDayCount: configItemDetails.couponConventionDayCount,
                couponConventionPaymentDayConvention: configItemDetails.couponConventionPaymentDayConvention,
                couponConventionTreasuryTermCoupon: configItemDetails.couponConventionTreasuryTermCoupon,
                couponConventionEndOfMonthConvention: configItemDetails.couponConventionEndOfMonthConvention,
                couponConventionTreasuryTermCouponBase: configItemDetails.couponConventionTreasuryTermCouponBase,
                couponConventionHolidayAdjustedCouponFlag: configItemDetails.couponConventionHolidayAdjustedCouponFlag,
                couponConventionPaymentType: configItemDetails.couponConventionPaymentType,
                couponConventionFixedRateDeCompounding: configItemDetails.couponConventionFixedRateDeCompounding,
                couponConventionInclExclOneDay: configItemDetails.couponConventionInclExclOneDay,
                couponConventionSequenceConvention: configItemDetails.couponConventionSequenceConvention,
                oddCouponsAndRedempOddConvLastCoupon: configItemDetails.oddCouponsAndRedempOddConvLastCoupon,
                oddCouponsAndRedempOddConvLastRedeption: configItemDetails.oddCouponsAndRedempOddConvLastRedeption,
                sequenceConventionRedemption: configItemDetails.sequenceConventionRedemption,
                couponConventionsDayCount: configItemDetails.couponConventionsDayCount,
                accruedInterestConventionsInterestType: configItemDetails.accruedInterestConventionsInterestType,
                accruedInterestConventionsTreasuryProduct: configItemDetails.accruedInterestConventionsTreasuryProduct,
                accruedInterestConventionsDayCountConvention: configItemDetails.accruedInterestConventionsDayCountConvention,
                accruedInterestConventionsCalculationMethod: configItemDetails.accruedInterestConventionsCalculationMethod,
                floatingRatesReferenceRate: configItemDetails.floatingRatesReferenceRate,
                floatingRatesSpreadRate: configItemDetails.floatingRatesSpreadRate,
                interestLookBackPeriod: configItemDetails.interestLookBackPeriod,
                interestMultiplierFactor: configItemDetails.interestMultiplierFactor,
                interestAdjustmentFixingDays: configItemDetails.interestAdjustmentFixingDays,
                defaultFixingDate: configItemDetails.defaultFixingDate,
                defaultFixingRate: configItemDetails.defaultFixingRate,
                fixingTerm: configItemDetails.fixingTerm,
                fixingUnits: configItemDetails.fixingUnits,
                rateResetHolidayCalender: configItemDetails.rateResetHolidayCalender,
                compoundingConvention: configItemDetails.compoundingConvention,
                spreadConventionOrCompounding: configItemDetails.spreadConventionOrCompounding,
                couponRateMinimum: configItemDetails.couponRateMinimum,
                couponRateMaximum: configItemDetails.couponRateMaximum,
                alternativeSecurityIdIdentificationSystem: configItemDetails.alternativeSecurityIdIdentificationSystem,
                alternativeSecurityIdLongSecurityName: configItemDetails.alternativeSecurityIdLongSecurityName,
                alternativeSecurityIdCusip: configItemDetails.alternativeSecurityIdCusip,
                alternativeSecurityIdIsin: configItemDetails.alternativeSecurityIdIsin,
                putCalls: configItemDetails.putCalls,
                clientSpecificFields: configItemDetails.clientSpecificFields,
                attachments: configItemDetails.attachments,
                comments: configItemDetails.comments,
                changedByUser: configItemDetails.changedByUser,
                changedDate: configItemDetails.changedDate,
                createdByUser: configItemDetails.createdByUser,
                isDeleted: configItemDetails.isDeleted,
                deletedBy: configItemDetails.deletedBy,
                deleteReason: configItemDetails.deleteReason,
                actionItemId: configItemDetails._id,
                action: helper.sysConst.permissionAccessTypes.EDIT,
                actionDate: new Date(),
                actionBy: req.appCurrentUserData._id,
            }, {session: session});
            await auditData.save();

            if (needToCommit) {
                await session.commitTransaction();
            }
            callback(null, {}, 'Bond Client Specific Fields updated successfully!');
        } catch (e) {
            await session.abortTransaction();
            callback(e, null, 'Server Error!');
        }
    },
    updateCommentsAndAttachments: async (req, data, session, needToCommit, callback) => {
        try {
            let id = req.validParamId;

            let configItem = await BondSecurityModel.find({_id: id, isDeleted: false});

            if (configItem.length === 0) {
                return callback({notFound: true}, null, `Bond Security with id => ${id} not found or deleted!`);
            }
            configItem = configItem[0];

            data.attachments = [...configItem.attachments, ...data.attachments];

            data.changedByUser = req.appCurrentUserData._id;
            data.changedDate = new Date();

            await BondSecurityModel.updateOne({_id: id}, data).session(session);

            let configItemDetails = await BondSecurityModel.find({_id: id, isDeleted: false}).session(session);
            configItemDetails = configItemDetails[0];

            const auditData = new BondSecurityAuditModel({
                securityId: configItemDetails.securityId,
                ISIN: configItemDetails.ISIN,
                userDefinedSecurityId: configItemDetails.userDefinedSecurityId,
                name: configItemDetails.name,
                securityCode: configItemDetails.securityCode,
                currency: configItemDetails.currency,
                paymentHolidayCalender: configItemDetails.paymentHolidayCalender,
                exchange: configItemDetails.exchange,
                quoted: configItemDetails.quoted,
                minTradeVolume: configItemDetails.minTradeVolume,
                volume: configItemDetails.volume,
                issuer: configItemDetails.issuer,
                issueDate: configItemDetails.issueDate,
                issuePrice: configItemDetails.issuePrice,
                redemptionPrice: configItemDetails.redemptionPrice,
                redemptionCurrency: configItemDetails.redemptionCurrency,
                interestType: configItemDetails.interestType,
                couponRate: configItemDetails.couponRate,
                maturityDate: configItemDetails.maturityDate,
                structure: configItemDetails.structure,
                firstRedemptionDate: configItemDetails.firstRedemptionDate,
                couponTerm: configItemDetails.couponTerm,
                couponTermUnit: configItemDetails.couponTermUnit,
                redemptionTerm: configItemDetails.redemptionTerm,
                redemptionTermUnit: configItemDetails.redemptionTermUnit,
                inceptionRedemptionRate: configItemDetails.inceptionRedemptionRate,
                currentPoolFactor: configItemDetails.currentPoolFactor,
                firstCouponPaymentDate: configItemDetails.firstCouponPaymentDate,
                quotation: configItemDetails.quotation,
                settlementDays: configItemDetails.settlementDays,
                quoteType: configItemDetails.quoteType,
                quotingLotSize: configItemDetails.quotingLotSize,
                quotingFaceValue: configItemDetails.quotingFaceValue,
                couponConventionDayCount: configItemDetails.couponConventionDayCount,
                couponConventionPaymentDayConvention: configItemDetails.couponConventionPaymentDayConvention,
                couponConventionTreasuryTermCoupon: configItemDetails.couponConventionTreasuryTermCoupon,
                couponConventionEndOfMonthConvention: configItemDetails.couponConventionEndOfMonthConvention,
                couponConventionTreasuryTermCouponBase: configItemDetails.couponConventionTreasuryTermCouponBase,
                couponConventionHolidayAdjustedCouponFlag: configItemDetails.couponConventionHolidayAdjustedCouponFlag,
                couponConventionPaymentType: configItemDetails.couponConventionPaymentType,
                couponConventionFixedRateDeCompounding: configItemDetails.couponConventionFixedRateDeCompounding,
                couponConventionInclExclOneDay: configItemDetails.couponConventionInclExclOneDay,
                couponConventionSequenceConvention: configItemDetails.couponConventionSequenceConvention,
                oddCouponsAndRedempOddConvLastCoupon: configItemDetails.oddCouponsAndRedempOddConvLastCoupon,
                oddCouponsAndRedempOddConvLastRedeption: configItemDetails.oddCouponsAndRedempOddConvLastRedeption,
                sequenceConventionRedemption: configItemDetails.sequenceConventionRedemption,
                couponConventionsDayCount: configItemDetails.couponConventionsDayCount,
                accruedInterestConventionsInterestType: configItemDetails.accruedInterestConventionsInterestType,
                accruedInterestConventionsTreasuryProduct: configItemDetails.accruedInterestConventionsTreasuryProduct,
                accruedInterestConventionsDayCountConvention: configItemDetails.accruedInterestConventionsDayCountConvention,
                accruedInterestConventionsCalculationMethod: configItemDetails.accruedInterestConventionsCalculationMethod,
                floatingRatesReferenceRate: configItemDetails.floatingRatesReferenceRate,
                floatingRatesSpreadRate: configItemDetails.floatingRatesSpreadRate,
                interestLookBackPeriod: configItemDetails.interestLookBackPeriod,
                interestMultiplierFactor: configItemDetails.interestMultiplierFactor,
                interestAdjustmentFixingDays: configItemDetails.interestAdjustmentFixingDays,
                defaultFixingDate: configItemDetails.defaultFixingDate,
                defaultFixingRate: configItemDetails.defaultFixingRate,
                fixingTerm: configItemDetails.fixingTerm,
                fixingUnits: configItemDetails.fixingUnits,
                rateResetHolidayCalender: configItemDetails.rateResetHolidayCalender,
                compoundingConvention: configItemDetails.compoundingConvention,
                spreadConventionOrCompounding: configItemDetails.spreadConventionOrCompounding,
                couponRateMinimum: configItemDetails.couponRateMinimum,
                couponRateMaximum: configItemDetails.couponRateMaximum,
                alternativeSecurityIdIdentificationSystem: configItemDetails.alternativeSecurityIdIdentificationSystem,
                alternativeSecurityIdLongSecurityName: configItemDetails.alternativeSecurityIdLongSecurityName,
                alternativeSecurityIdCusip: configItemDetails.alternativeSecurityIdCusip,
                alternativeSecurityIdIsin: configItemDetails.alternativeSecurityIdIsin,
                putCalls: configItemDetails.putCalls,
                clientSpecificFields: configItemDetails.clientSpecificFields,
                attachments: configItemDetails.attachments,
                comments: configItemDetails.comments,
                changedByUser: configItemDetails.changedByUser,
                changedDate: configItemDetails.changedDate,
                createdByUser: configItemDetails.createdByUser,
                isDeleted: configItemDetails.isDeleted,
                deletedBy: configItemDetails.deletedBy,
                deleteReason: configItemDetails.deleteReason,
                actionItemId: configItemDetails._id,
                action: helper.sysConst.permissionAccessTypes.EDIT,
                actionDate: new Date(),
                actionBy: req.appCurrentUserData._id,
            }, {session: session});
            await auditData.save();

            if (needToCommit) {
                await session.commitTransaction();
            }
            callback(null, {}, 'Bond Comments And Attachments updated successfully!');
        } catch (e) {
            await session.abortTransaction();
            callback(e, null, 'Server Error!');
        }
    },
    removeAttachments: async (req, data, session, needToCommit, callback) => {
        try {
            let id = req.validParamId;

            let configItem = await BondSecurityModel.find({_id: id, isDeleted: false});

            if (configItem.length === 0) {
                return callback({notFound: true}, null, `Bond Security with id => ${id} not found or deleted!`);
            }
            configItem = configItem[0];

            let attachments = [];

            configItem.attachments.forEach((item) => {
                if (item !== data.url) {
                    attachments.push(item);
                }
            });

            data = {};
            data.attachments = attachments;
            data.changedByUser = req.appCurrentUserData._id;
            data.changedDate = new Date();

            await BondSecurityModel.updateOne({_id: id}, data).session(session);

            let configItemDetails = await BondSecurityModel.find({_id: id, isDeleted: false}).session(session);
            configItemDetails = configItemDetails[0];

            const auditData = new BondSecurityAuditModel({
                securityId: configItemDetails.securityId,
                ISIN: configItemDetails.ISIN,
                userDefinedSecurityId: configItemDetails.userDefinedSecurityId,
                name: configItemDetails.name,
                securityCode: configItemDetails.securityCode,
                currency: configItemDetails.currency,
                paymentHolidayCalender: configItemDetails.paymentHolidayCalender,
                exchange: configItemDetails.exchange,
                quoted: configItemDetails.quoted,
                minTradeVolume: configItemDetails.minTradeVolume,
                volume: configItemDetails.volume,
                issuer: configItemDetails.issuer,
                issueDate: configItemDetails.issueDate,
                issuePrice: configItemDetails.issuePrice,
                redemptionPrice: configItemDetails.redemptionPrice,
                redemptionCurrency: configItemDetails.redemptionCurrency,
                interestType: configItemDetails.interestType,
                couponRate: configItemDetails.couponRate,
                maturityDate: configItemDetails.maturityDate,
                structure: configItemDetails.structure,
                firstRedemptionDate: configItemDetails.firstRedemptionDate,
                couponTerm: configItemDetails.couponTerm,
                couponTermUnit: configItemDetails.couponTermUnit,
                redemptionTerm: configItemDetails.redemptionTerm,
                redemptionTermUnit: configItemDetails.redemptionTermUnit,
                inceptionRedemptionRate: configItemDetails.inceptionRedemptionRate,
                currentPoolFactor: configItemDetails.currentPoolFactor,
                firstCouponPaymentDate: configItemDetails.firstCouponPaymentDate,
                quotation: configItemDetails.quotation,
                settlementDays: configItemDetails.settlementDays,
                quoteType: configItemDetails.quoteType,
                quotingLotSize: configItemDetails.quotingLotSize,
                quotingFaceValue: configItemDetails.quotingFaceValue,
                couponConventionDayCount: configItemDetails.couponConventionDayCount,
                couponConventionPaymentDayConvention: configItemDetails.couponConventionPaymentDayConvention,
                couponConventionTreasuryTermCoupon: configItemDetails.couponConventionTreasuryTermCoupon,
                couponConventionEndOfMonthConvention: configItemDetails.couponConventionEndOfMonthConvention,
                couponConventionTreasuryTermCouponBase: configItemDetails.couponConventionTreasuryTermCouponBase,
                couponConventionHolidayAdjustedCouponFlag: configItemDetails.couponConventionHolidayAdjustedCouponFlag,
                couponConventionPaymentType: configItemDetails.couponConventionPaymentType,
                couponConventionFixedRateDeCompounding: configItemDetails.couponConventionFixedRateDeCompounding,
                couponConventionInclExclOneDay: configItemDetails.couponConventionInclExclOneDay,
                couponConventionSequenceConvention: configItemDetails.couponConventionSequenceConvention,
                oddCouponsAndRedempOddConvLastCoupon: configItemDetails.oddCouponsAndRedempOddConvLastCoupon,
                oddCouponsAndRedempOddConvLastRedeption: configItemDetails.oddCouponsAndRedempOddConvLastRedeption,
                sequenceConventionRedemption: configItemDetails.sequenceConventionRedemption,
                couponConventionsDayCount: configItemDetails.couponConventionsDayCount,
                accruedInterestConventionsInterestType: configItemDetails.accruedInterestConventionsInterestType,
                accruedInterestConventionsTreasuryProduct: configItemDetails.accruedInterestConventionsTreasuryProduct,
                accruedInterestConventionsDayCountConvention: configItemDetails.accruedInterestConventionsDayCountConvention,
                accruedInterestConventionsCalculationMethod: configItemDetails.accruedInterestConventionsCalculationMethod,
                floatingRatesReferenceRate: configItemDetails.floatingRatesReferenceRate,
                floatingRatesSpreadRate: configItemDetails.floatingRatesSpreadRate,
                interestLookBackPeriod: configItemDetails.interestLookBackPeriod,
                interestMultiplierFactor: configItemDetails.interestMultiplierFactor,
                interestAdjustmentFixingDays: configItemDetails.interestAdjustmentFixingDays,
                defaultFixingDate: configItemDetails.defaultFixingDate,
                defaultFixingRate: configItemDetails.defaultFixingRate,
                fixingTerm: configItemDetails.fixingTerm,
                fixingUnits: configItemDetails.fixingUnits,
                rateResetHolidayCalender: configItemDetails.rateResetHolidayCalender,
                compoundingConvention: configItemDetails.compoundingConvention,
                spreadConventionOrCompounding: configItemDetails.spreadConventionOrCompounding,
                couponRateMinimum: configItemDetails.couponRateMinimum,
                couponRateMaximum: configItemDetails.couponRateMaximum,
                alternativeSecurityIdIdentificationSystem: configItemDetails.alternativeSecurityIdIdentificationSystem,
                alternativeSecurityIdLongSecurityName: configItemDetails.alternativeSecurityIdLongSecurityName,
                alternativeSecurityIdCusip: configItemDetails.alternativeSecurityIdCusip,
                alternativeSecurityIdIsin: configItemDetails.alternativeSecurityIdIsin,
                putCalls: configItemDetails.putCalls,
                clientSpecificFields: configItemDetails.clientSpecificFields,
                attachments: configItemDetails.attachments,
                comments: configItemDetails.comments,
                changedByUser: configItemDetails.changedByUser,
                changedDate: configItemDetails.changedDate,
                createdByUser: configItemDetails.createdByUser,
                isDeleted: configItemDetails.isDeleted,
                deletedBy: configItemDetails.deletedBy,
                deleteReason: configItemDetails.deleteReason,
                actionItemId: configItemDetails._id,
                action: helper.sysConst.permissionAccessTypes.EDIT,
                actionDate: new Date(),
                actionBy: req.appCurrentUserData._id,
            }, {session: session});
            await auditData.save();

            if (needToCommit) {
                await session.commitTransaction();
            }
            callback(null, {}, 'Bond Attachment removed successfully!');
        } catch (e) {
            await session.abortTransaction();
            callback(e, null, 'Server Error!');
        }
    }
}

function insertData(req, inputData, counter = 0, callback, onError) {

    bondDataValidator.generalDetailsValidator(inputData, async (err, data, msg) => {
        if (err) {
            return callback(counter, false, msg);
        } else {
            let session = await mongo.startSession();
            session.startTransaction();

            await bondDataUpdate.createBond(req, data, session, false, (err, data, msg) => {
                if (err) {
                    return callback(counter, false, msg);
                } else {

                    //update other market info

                    req.validParamId = data._id;
                    bondDataValidator.marketConventionValidator(inputData, async (err, data, msg) => {
                        if (err) {
                            await session.abortTransaction();
                            return callback(counter, false, msg);
                        } else {

                            await bondDataUpdate.updateMarketConvention(req, data, session, false, (err, data, msg) => {
                                if (err) {
                                    callback(counter, false, msg);
                                } else {

                                    // insert reference rates info
                                    bondDataValidator.referenceRateValidator(req.body, async (err, data, msg) => {
                                        if (err) {
                                            await session.abortTransaction();
                                            return callback(counter, false, msg);
                                        } else {

                                            await bondDataUpdate.updateReferenceRate(req, data, session, false, (err, data, msg) => {
                                                if (err) {
                                                    return callback(counter, false, msg);
                                                } else {

                                                    // insert alternative security info

                                                    bondDataValidator.alternativeSecurityIdValidator(req.body, async (err, data, msg) => {
                                                        if (err) {
                                                            await session.abortTransaction();
                                                            return callback(counter, false, msg);
                                                        } else {

                                                            await bondDataUpdate.updateAlternativeSecurityId(req, data, session, false, (err, data, msg) => {
                                                                if (err) {
                                                                    return callback(counter, false, msg);
                                                                } else {

                                                                    // update puts calls info

                                                                    bondDataValidator.putCallValidator(req.body, async (err, data, msg) => {
                                                                        if (err) {
                                                                            await session.abortTransaction();
                                                                            return callback(counter, false, msg);
                                                                        } else {

                                                                            await bondDataUpdate.updatePutCall(req, data, session, false, (err, data, msg) => {
                                                                                if (err) {
                                                                                    return callback(counter, false, msg);
                                                                                } else {

                                                                                    // update additional fields info

                                                                                    bondDataValidator.clientSpecificFieldsValidator(req.body, async (err, data, msg) => {
                                                                                        if (err) {
                                                                                            await session.abortTransaction();
                                                                                            return callback(counter, false, msg);
                                                                                        } else {
                                                                                            await bondDataUpdate.updateClientSpecificFields(req, data, session, false, (err, data, msg) => {
                                                                                                if (err) {
                                                                                                    return callback(counter, false, msg);
                                                                                                } else {

                                                                                                    //update comments and attachments

                                                                                                    bondDataValidator.commentAndAttachmentValidator(req.body, async (err, data, msg) => {
                                                                                                        if (err) {
                                                                                                            await session.abortTransaction();
                                                                                                            return callback(counter, false, msg);
                                                                                                        } else {

                                                                                                            await bondDataUpdate.updateCommentsAndAttachments(req, data, session, true, (err, data, msg) => {
                                                                                                                if (err) {
                                                                                                                    callback(counter, false, msg);
                                                                                                                } else {
                                                                                                                    callback(counter, true, 'Bond Details Inserted successfully!');
                                                                                                                }
                                                                                                            }).catch((err) => {
                                                                                                                onError(counter, err);
                                                                                                            }).finally(() => {
                                                                                                                session.endSession();
                                                                                                            });
                                                                                                        }
                                                                                                    });

                                                                                                }
                                                                                            }).catch((err) => {
                                                                                                onError(counter, err);
                                                                                            }).finally(() => {
                                                                                                session.endSession();
                                                                                            });
                                                                                        }
                                                                                    });

                                                                                }
                                                                            }).catch((err) => {
                                                                                onError(counter, err);
                                                                            }).finally(() => {
                                                                                session.endSession();
                                                                            });
                                                                        }
                                                                    });

                                                                }
                                                            }).catch((err) => {
                                                                onError(counter, err);
                                                            }).finally(() => {
                                                                session.endSession();
                                                            });
                                                        }
                                                    });

                                                }
                                            }).catch((err) => {
                                                onError(counter, err);
                                            }).finally(() => {
                                                session.endSession();
                                            });
                                        }
                                    });

                                }
                            }).catch((err) => {
                                onError(counter, err);
                            }).finally(() => {
                                session.endSession();
                            });
                        }
                    });

                }
            }).catch((err) => {
                onError(counter, err);
            }).finally(() => {
                session.endSession();
            });
        }
    });
}

/**
 * @swagger
 * /api/v1/bond/add/general:
 *  post:
 *      summary: Add Bond General Information
 *      tags: [Bond]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          securityId:
 *                              type: string
 *                              default: SECID
 *                          ISIN:
 *                              type: string
 *                              default: IKLNON231
 *                          userDefinedSecurityId:
 *                              type: string
 *                              default: SECID2022
 *                          name:
 *                              type: string
 *                              default: SECURITYBOOM
 *                          securityCode:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          currency:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          paymentHolidayCalender:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          exchange:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          quoted:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          minTradeVolume:
 *                              type: number
 *                              default: 0
 *                          volume:
 *                              type: number
 *                              default: 10.2
 *                          issuer:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          issueDate:
 *                              type: string
 *                              default: 2022-01-01
 *                          issuePrice:
 *                              type: string
 *                              default: 105481.25
 *                          redemptionPrice:
 *                              type: string
 *                              default: 95485
 *                          redemptionCurrency:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          interestType:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          couponRate:
 *                              type: string
 *                              default: FIB
 *                          maturityDate:
 *                              type: string
 *                              default: 2022-05-01
 *                          structure:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          firstRedemptionDate:
 *                              type: string
 *                              default: 2022-06-01
 *                          couponTerm:
 *                              type: string
 *                              default: 5
 *                          couponTermUnit:
 *                              type: string
 *                              default: Days
 *                          redemptionTerm:
 *                              type: string
 *                              default: 2
 *                          redemptionTermUnit:
 *                              type: string
 *                              default: Month
 *                          inceptionRedemptionRate:
 *                              type: string
 *                              default: 50.19
 *                          currentPoolFactor:
 *                              type: string
 *                              default: 15.78
 *                          firstCouponPaymentDate:
 *                              type: string
 *                              default: 2022-07-01
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add/general", authUser, bondSecurityMiddleware.canCreate, (req, res) => {
    bondDataValidator.generalDetailsValidator(req.body, async (err, data, msg) => {
        if (err) {
            br.sendNotSuccessful(res, msg, err);
        } else {
            let session = await mongo.startSession();
            session.startTransaction();

            await bondDataUpdate.createBond(req, data, session, true, (err, data, msg) => {
                if (err) {
                    br.sendNotSuccessful(res, msg, err);
                } else {
                    br.sendSuccess(res, data, msg);
                }
            }).catch((err) => {
                br.sendServerError(res, err);
            }).finally(() => {
                session.endSession();
            });
        }
    });
});

/**
 * @swagger
 * /api/v1/bond/update/general/{id}:
 *  put:
 *      summary: Update Bond General Information
 *      tags: [Bond]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Bond Security Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          securityId:
 *                              type: string
 *                              default: SECID
 *                          ISIN:
 *                              type: string
 *                              default: IKLNON231
 *                          userDefinedSecurityId:
 *                              type: string
 *                              default: SECID2022
 *                          name:
 *                              type: string
 *                              default: SECURITYBOOM
 *                          securityCode:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          currency:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          paymentHolidayCalender:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          exchange:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          quoted:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          minTradeVolume:
 *                              type: number
 *                              default: 0
 *                          volume:
 *                              type: number
 *                              default: 10.2
 *                          issuer:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          issueDate:
 *                              type: string
 *                              default: 2022-01-01
 *                          issuePrice:
 *                              type: string
 *                              default: 105481.25
 *                          redemptionPrice:
 *                              type: string
 *                              default: 95485
 *                          redemptionCurrency:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          interestType:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          couponRate:
 *                              type: string
 *                              default: FIB
 *                          maturityDate:
 *                              type: string
 *                              default: 2022-05-01
 *                          structure:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          firstRedemptionDate:
 *                              type: string
 *                              default: 2022-06-01
 *                          couponTerm:
 *                              type: string
 *                              default: 5
 *                          couponTermUnit:
 *                              type: string
 *                              default: Days
 *                          redemptionTerm:
 *                              type: string
 *                              default: 2
 *                          redemptionTermUnit:
 *                              type: string
 *                              default: Month
 *                          inceptionRedemptionRate:
 *                              type: string
 *                              default: 50.19
 *                          currentPoolFactor:
 *                              type: string
 *                              default: 15.78
 *                          firstCouponPaymentDate:
 *                              type: string
 *                              default: 2022-07-01
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/general/:id", authUser, bondSecurityMiddleware.canUpdate, isValidParamId, (req, res) => {
    bondDataValidator.generalDetailsValidator(req.body, async (err, data, msg) => {
        if (err) {
            br.sendNotSuccessful(res, msg, err);
        } else {
            let session = await mongo.startSession();
            session.startTransaction();

            await bondDataUpdate.updateBondGeneral(req, data, session, true, (err, data, msg) => {
                if (err) {
                    br.sendNotSuccessful(res, msg, err);
                } else {
                    br.sendSuccess(res, data, msg);
                }
            }).catch((err) => {
                br.sendServerError(res, err);
            }).finally(() => {
                session.endSession();
            });
        }
    });
});

/**
 * @swagger
 * /api/v1/bond/update/market-conversion/{id}:
 *  put:
 *      summary: Add Bond Market Conversion Information
 *      tags: [Bond]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Bond Security Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          quotation:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          settlementDays:
 *                              type: number
 *                              default: 67
 *                          quoteType:
 *                              type: number
 *                              default: 1
 *                          quotingLotSize:
 *                              type: number
 *                              default: 3
 *                          quotingFaceValue:
 *                              type: string
 *                              default: 7
 *                          couponConventionDayCount:
 *                              type: number
 *                              default: 2
 *                          couponConventionPaymentDayConvention:
 *                              type: string
 *                              default: 2022-02-01
 *                          couponConventionTreasuryTermCoupon:
 *                              type: boolean
 *                              default: true
 *                          couponConventionEndOfMonthConvention:
 *                              type: string
 *                              default: 2022-02-01
 *                          couponConventionTreasuryTermCouponBase:
 *                              type: boolean
 *                              default: true
 *                          couponConventionHolidayAdjustedCouponFlag:
 *                              type: boolean
 *                              default: true
 *                          couponConventionPaymentType:
 *                              type: string
 *                              default: Type
 *                          couponConventionFixedRateDeCompounding:
 *                              type: boolean
 *                              default: true
 *                          couponConventionInclExclOneDay:
 *                              type: boolean
 *                              default: true
 *                          couponConventionSequenceConvention:
 *                              type: string
 *                              default: any string
 *                          oddCouponsAndRedempOddConvLastCoupon:
 *                              type: string
 *                              default: Regular
 *                          oddCouponsAndRedempOddConvLastRedeption:
 *                              type: string
 *                              default: Irregular
 *                          sequenceConventionRedemption:
 *                              type: string
 *                              default: DWE
 *                          couponConventionsDayCount:
 *                              type: string
 *                              default: VFSD
 *                          accruedInterestConventionsInterestType:
 *                              type: boolean
 *                              default: true
 *                          accruedInterestConventionsTreasuryProduct:
 *                              type: boolean
 *                              default: true
 *                          accruedInterestConventionsDayCountConvention:
 *                              type: string
 *                              default: HD2
 *                          accruedInterestConventionsCalculationMethod:
 *                              type: string
 *                              default: SCE2
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/market-conversion/:id", authUser, bondSecurityMiddleware.canUpdate, isValidParamId, (req, res) => {
    bondDataValidator.marketConventionValidator(req.body, async (err, data, msg) => {
        if (err) {
            br.sendNotSuccessful(res, msg, err);
        } else {
            let session = await mongo.startSession();
            session.startTransaction();

            await bondDataUpdate.updateMarketConvention(req, data, session, true, (err, data, msg) => {
                if (err) {
                    br.sendNotSuccessful(res, msg, err);
                } else {
                    br.sendSuccess(res, data, msg);
                }
            }).catch((err) => {
                br.sendServerError(res, err);
            }).finally(() => {
                session.endSession();
            });
        }
    });
});

/**
 * @swagger
 * /api/v1/bond/update/reference-rate/{id}:
 *  put:
 *      summary: Add Bond Reference Rate Information
 *      tags: [Bond]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Bond Security Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          floatingRatesReferenceRate:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          floatingRatesSpreadRate:
 *                              type: number
 *                              default: 67.41
 *                          interestLookBackPeriod:
 *                              type: number
 *                              default: 1
 *                          interestMultiplierFactor:
 *                              type: number
 *                              default: 3
 *                          interestAdjustmentFixingDays:
 *                              type: boolean
 *                              default: false
 *                          defaultFixingDate:
 *                              type: string
 *                              default: 2020-02-01
 *                          defaultFixingRate:
 *                              type: number
 *                              default: 20.3
 *                          fixingTerm:
 *                              type: number
 *                              default: 3
 *                          fixingUnits:
 *                              type: string
 *                              default: Day
 *                          rateResetHolidayCalender:
 *                              type: string
 *                              default: 62d386b9f1481cef3650a40f
 *                          compoundingConvention:
 *                              type: string
 *                              default: Compound
 *                          spreadConventionOrCompounding:
 *                              type: string
 *                              default: Compound and Add
 *                          couponRateMinimum:
 *                              type: number
 *                              default: 25
 *                          couponRateMaximum:
 *                              type: number
 *                              default: 55
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/reference-rate/:id", authUser, bondSecurityMiddleware.canUpdate, isValidParamId, (req, res) => {
    bondDataValidator.referenceRateValidator(req.body, async (err, data, msg) => {
        if (err) {
            br.sendNotSuccessful(res, msg, err);
        } else {
            let session = await mongo.startSession();
            session.startTransaction();

            await bondDataUpdate.updateReferenceRate(req, data, session, true, (err, data, msg) => {
                if (err) {
                    br.sendNotSuccessful(res, msg, err);
                } else {
                    br.sendSuccess(res, data, msg);
                }
            }).catch((err) => {
                br.sendServerError(res, err);
            }).finally(() => {
                session.endSession();
            });
        }
    });
});

/**
 * @swagger
 * /api/v1/bond/update/alternative-security-id/{id}:
 *  put:
 *      summary: Add Bond Alternative security Information
 *      tags: [Bond]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Bond Security Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          alternativeSecurityIdIdentificationSystem:
 *                              type: string
 *                              default: Info
 *                          alternativeSecurityIdLongSecurityName:
 *                              type: string
 *                              default: Additional
 *                          alternativeSecurityIdCusip:
 *                              type: string
 *                              default: CUSIP
 *                          alternativeSecurityIdIsin:
 *                              type: string
 *                              default: ISIN
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/alternative-security-id/:id", authUser, bondSecurityMiddleware.canUpdate, isValidParamId, (req, res) => {
    bondDataValidator.alternativeSecurityIdValidator(req.body, async (err, data, msg) => {
        if (err) {
            br.sendNotSuccessful(res, msg, err);
        } else {
            let session = await mongo.startSession();
            session.startTransaction();

            await bondDataUpdate.updateAlternativeSecurityId(req, data, session, true, (err, data, msg) => {
                if (err) {
                    br.sendNotSuccessful(res, msg, err);
                } else {
                    br.sendSuccess(res, data, msg);
                }
            }).catch((err) => {
                br.sendServerError(res, err);
            }).finally(() => {
                session.endSession();
            });
        }
    });
});

/**
 * @swagger
 * /api/v1/bond/update/put-calls/{id}:
 *  put:
 *      summary: Add Bond Puts & calls Information
 *      tags: [Bond]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Bond Security Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          putCalls:
 *                              type: array
 *                              items:
 *                                  type: object
 *                                  properties:
 *                                      fromDate:
 *                                          type: string
 *                                          default: 2022-02-01
 *                                      toDate:
 *                                          type: string
 *                                          default: 2023-02-01
 *                                      price:
 *                                          type: integer
 *                                          default: 200
 *                                      noOfDays:
 *                                          type: integer
 *                                          default: 5
 *                                      optionType:
 *                                          type: string
 *                                          default: Put
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/put-calls/:id", authUser, bondSecurityMiddleware.canUpdate, isValidParamId, (req, res) => {
    bondDataValidator.putCallValidator(req.body, async (err, data, msg) => {
        if (err) {
            br.sendNotSuccessful(res, msg, err);
        } else {
            let session = await mongo.startSession();
            session.startTransaction();

            await bondDataUpdate.updatePutCall(req, data, session, true, (err, data, msg) => {
                if (err) {
                    br.sendNotSuccessful(res, msg, err);
                } else {
                    br.sendSuccess(res, data, msg);
                }
            }).catch((err) => {
                br.sendServerError(res, err);
                session.abortTransaction();
            }).finally(() => {
                session.endSession();
            });
        }
    });
});

/**
 * @swagger
 * /api/v1/bond/update/client-specific-fields/{id}:
 *  put:
 *      summary: Update Bond Client Specific Fields Information
 *      tags: [Bond]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Bond Security Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          clientSpecificFields:
 *                              type: array
 *                              items:
 *                                  type: object
 *                                  properties:
 *                                      name:
 *                                          type: string
 *                                          default: FieldName1
 *                                      value:
 *                                          type: string
 *                                          default: fileds23412
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/client-specific-fields/:id", authUser, bondSecurityMiddleware.canUpdate, isValidParamId, (req, res) => {
    bondDataValidator.clientSpecificFieldsValidator(req.body, async (err, data, msg) => {
        if (err) {
            br.sendNotSuccessful(res, msg, err);
        } else {
            let session = await mongo.startSession();
            session.startTransaction();

            await bondDataUpdate.updateClientSpecificFields(req, data, session, true, (err, data, msg) => {
                if (err) {
                    br.sendNotSuccessful(res, msg, err);
                } else {
                    br.sendSuccess(res, data, msg);
                }
            }).catch((err) => {
                session.abortTransaction();
            }).finally(() => {
                session.endSession();
            });
        }
    });
});

/**
 * @swagger
 * /api/v1/bond/update/comments-and-attachments/{id}:
 *  put:
 *      summary: Update Bond Comments And Attachment Information
 *      tags: [Bond]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Bond Security Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              multipart/form-data:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          comments:
 *                              type: string
 *                              default: Comments
 *                          files:
 *                              type: array
 *                              items:
 *                                  type: string
 *                                  format: binary
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/comments-and-attachments/:id", authUser, bondSecurityMiddleware.canUpdate, isValidParamId, bondAttachUploader.array('files'), (req, res) => {
    bondDataValidator.commentAndAttachmentValidator(req.body, async (err, data, msg) => {
        if (err) {
            br.sendNotSuccessful(res, msg, err);
        } else {

            if (req.files.length > 0) {
                let attachments = [];
                req.files.forEach((item) => {
                    attachments.push(item.replace(/\\/g, '/').replace('Public/Images/', 'Images/'));
                });
                data.attachments = attachments;
            }

            let session = await mongo.startSession();
            session.startTransaction();

            await bondDataUpdate.updateCommentsAndAttachments(req, data, session, true, (err, data, msg) => {
                if (err) {
                    br.sendNotSuccessful(res, msg, err);
                } else {
                    br.sendSuccess(res, data, msg);
                }
            }).catch((err) => {
                br.sendServerError(res, err);
            }).finally(() => {
                session.endSession();
            });
        }
    });
});

/**
 * @swagger
 * /api/v1/bond/update/attachments/remove/{id}:
 *  put:
 *      summary: Remove Bond Attachments Information
 *      tags: [Bond]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Bond Security Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          url:
 *                              type: string
 *                              default: /public/uploads/bond/attachments/filename.jpg
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/attachments/remove/:id", authUser, bondSecurityMiddleware.canUpdate, isValidParamId, (req, res) => {
    bondDataValidator.removeAttachmentValidator(req.body, async (err, data, msg) => {
        if (err) {
            br.sendNotSuccessful(res, msg, err);
        } else {
            let session = await mongo.startSession();
            session.startTransaction();

            await bondDataUpdate.removeAttachments(req, data, session, true, (err, data, msg) => {
                if (err) {
                    br.sendNotSuccessful(res, msg, err);
                } else {
                    br.sendSuccess(res, data, msg);
                }
            }).catch((err) => {
                br.sendServerError(res, err);
            }).finally(() => {
                session.endSession();
            });
        }
    });
});

/**
 * @swagger
 * /api/v1/bond/add/bulk:
 *  post:
 *      summary: Add Bulk Bond Security using csv file
 *      tags: [Bond]
 *      requestBody:
 *          required: true
 *          content:
 *              multipart/form-data:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          file:
 *                              type: string
 *                              format: binary
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add/bulk", authUser, bondSecurityMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Bond Security', insertData);
});

/**
 * @swagger
 * /api/v1/bond/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Bond]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, bondSecurityMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'securityId',
                'ISIN',
                'userDefinedSecurityId',
                'name',
                'securityCode',
                'currency',
                'paymentHolidayCalender',
                'exchange',
                'quoted',
                'minTradeVolume',
                'volume',
                'issuer',
                'issueDate',
                'issuePrice',
                'redemptionPrice',
                'redemptionCurrency',
                'interestType',
                'couponRate',
                'maturityDate',
                'structure',
                'firstRedemptionDate',
                'couponTerm',
                'couponTermUnit',
                'redemptionTerm',
                'redemptionTermUnit',
                'inceptionRedemptionRate',
                'currentPoolFactor',
                'firstCouponPaymentDate',
                'quotation',
                'settlementDays',
                'quoteType',
                'quotingLotSize',
                'quotingFaceValue',
                'couponConventionDayCount',
                'couponConventionPaymentDayConvention',
                'couponConventionTreasuryTermCoupon',
                'couponConventionEndOfMonthConvention',
                'couponConventionTreasuryTermCouponBase',
                'couponConventionHolidayAdjustedCouponFlag',
                'couponConventionPaymentType',
                'couponConventionFixedRateDeCompounding',
                'couponConventionInclExclOneDay',
                'couponConventionSequenceConvention',
                'oddCouponsAndRedempOddConvLastCoupon',
                'oddCouponsAndRedempOddConvLastRedeption',
                'sequenceConventionRedemption',
                'couponConventionsDayCount',
                'accruedInterestConventionsInterestType',
                'accruedInterestConventionsTreasuryProduct',
                'accruedInterestConventionsDayCountConvention',
                'accruedInterestConventionsCalculationMethod',
                'floatingRatesReferenceRate',
                'floatingRatesSpreadRate',
                'interestLookBackPeriod',
                'interestMultiplierFactor',
                'interestAdjustmentFixingDays',
                'defaultFixingDate',
                'defaultFixingRate',
                'fixingTerm',
                'fixingUnits',
                'rateResetHolidayCalender',
                'compoundingConvention',
                'spreadConventionOrCompounding',
                'couponRateMinimum',
                'couponRateMaximum',
                'alternativeSecurityIdIdentificationSystem',
                'alternativeSecurityIdLongSecurityName',
                'alternativeSecurityIdCusip',
                'alternativeSecurityIdIsin',
                'putCalls',
                'clientSpecificFields',
                'attachments'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=bondSecurityBulkInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/bond/get-all:
 *  get:
 *      summary: Get all Bond
 *      tags: [Bond]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Key
 *        default: Any
 *      - name: searchKey
 *        in: query
 *        description: Need to mention if you try to search
 *        default: securityId
 *      - name: page
 *        in: query
 *        description: Current page number
 *        default: 1
 *      - name: perPage
 *        in: query
 *        description: Items per page
 *        default: 5
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, bondSecurityMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        let eligibleSearchKeys = [
            "securityId",
            "ISIN",
            "userDefinedSecurityId",
            "name",
            "couponRate",
            "couponTermUnit",
            "redemptionTermUnit",
            "inceptionRedemptionRate",
            "currentPoolFactor",
            "couponConventionPaymentType",
            "couponConventionSequenceConvention",
            "oddCouponsAndRedempOddConvLastCoupon",
            "oddCouponsAndRedempOddConvLastRedeption",
            "sequenceConventionRedemption",
            "couponConventionsDayCount",
            "accruedInterestConventionsDayCountConvention",
            "accruedInterestConventionsCalculationMethod",
            "defaultFixingDate",
            "fixingUnits",
            "compoundingConvention",
            "spreadConventionOrCompounding",
            "alternativeSecurityIdIdentificationSystem",
            "alternativeSecurityIdLongSecurityName",
            "alternativeSecurityIdCusip",
            "alternativeSecurityIdIsin"
        ];

        if(req.query.searchKey !== undefined && eligibleSearchKeys.includes(req.query.searchKey.toString())){
            let searchKey = req.query.searchKey.toString();
            let searchData = req.query.search !== undefined ? req.query.search.toString() : '';
            logger.info(`SearchKey: ${req.query.searchKey} => ${req.query.search}`);

            filter[searchKey] = {
                $regex: new RegExp(`^${searchData}`, 'i'),
            }
        }

        /*        if (req.query.search !== undefined && req.query.search.length > 0) {
                    filter.costBasisProfileName = {
                        $regex: new RegExp('^' + req.query.search, 'i'),
                    }
                }*/

        console.log(filter);
        let result = {
            total: 0,
            perPage: 5,
            from: 0,
            to: 0,
            lastPage: null,
            nextPage: null,
            currentPage: 1,
            data: []
        };

        if (parseInt(req.query.perPage) > 0) {
            result.perPage = parseInt(req.query.perPage);
        }

        if (parseInt(req.query.page) > 0) {
            result.currentPage = parseInt(req.query.page);
        }

        result.total = await BondSecurityModel.find(filter).count();
        let lp = Math.ceil(result.total / result.perPage);
        let offset = (result.currentPage - 1) * result.perPage;
        result.lastPage = lp > 1 ? lp : null;
        result.nextPage = result.total > (result.perPage * result.currentPage ) ? result.currentPage + 1 : null;

        if (result.total <= (result.currentPage * result.perPage)) {
            result.data = await BondSecurityModel.find(filter)
                .skip(offset)
                .limit(result.perPage)
                .populate([
                    'securityCode',
                    'currency',
                    'paymentHolidayCalender',
                    'exchange',
                    'quoted',
                    'issuer',
                    'redemptionCurrency',
                    'interestType',
                    'structure'
                ]);
        }

        result.from = offset + 1;
        result.to = offset + result.data.length;

        br.sendSuccess(res, result);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/bond/get/{id}:
 *  get:
 *      summary: get Bond Security details by id
 *      tags: [Bond]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Bond Security Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, bondSecurityMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await BondSecurityModel
            .find({_id: id, isDeleted: false})
            .populate([
                'securityCode',
                'currency',
                'paymentHolidayCalender',
                'exchange',
                'quoted',
                'issuer',
                'redemptionCurrency',
                'interestType',
                'structure'
            ]);

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Bond Security with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/bond/delete/{id}:
 *  delete:
 *      summary: delete Bond Security details by id
 *      tags: [Bond]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Bond Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      - name: deleteReason
 *        in: query
 *        description: delete reason
 *        default: 'N/A'
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.delete("/delete/:id", authUser, bondSecurityMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await BondSecurityModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Bond Security with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await BondSecurityModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await BondSecurityModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new BondSecurityModel({
            securityId: configItemDetails.securityId,
            ISIN: configItemDetails.ISIN,
            userDefinedSecurityId: configItemDetails.userDefinedSecurityId,
            name: configItemDetails.name,
            securityCode: configItemDetails.securityCode,
            currency: configItemDetails.currency,
            paymentHolidayCalender: configItemDetails.paymentHolidayCalender,
            exchange: configItemDetails.exchange,
            quoted: configItemDetails.quoted,
            minTradeVolume: configItemDetails.minTradeVolume,
            volume: configItemDetails.volume,
            issuer: configItemDetails.issuer,
            issueDate: configItemDetails.issueDate,
            issuePrice: configItemDetails.issuePrice,
            redemptionPrice: configItemDetails.redemptionPrice,
            redemptionCurrency: configItemDetails.redemptionCurrency,
            interestType: configItemDetails.interestType,
            couponRate: configItemDetails.couponRate,
            maturityDate: configItemDetails.maturityDate,
            structure: configItemDetails.structure,
            firstRedemptionDate: configItemDetails.firstRedemptionDate,
            couponTerm: configItemDetails.couponTerm,
            couponTermUnit: configItemDetails.couponTermUnit,
            redemptionTerm: configItemDetails.redemptionTerm,
            redemptionTermUnit: configItemDetails.redemptionTermUnit,
            inceptionRedemptionRate: configItemDetails.inceptionRedemptionRate,
            currentPoolFactor: configItemDetails.currentPoolFactor,
            firstCouponPaymentDate: configItemDetails.firstCouponPaymentDate,
            quotation: configItemDetails.quotation,
            settlementDays: configItemDetails.settlementDays,
            quoteType: configItemDetails.quoteType,
            quotingLotSize: configItemDetails.quotingLotSize,
            quotingFaceValue: configItemDetails.quotingFaceValue,
            couponConventionDayCount: configItemDetails.couponConventionDayCount,
            couponConventionPaymentDayConvention: configItemDetails.couponConventionPaymentDayConvention,
            couponConventionTreasuryTermCoupon: configItemDetails.couponConventionTreasuryTermCoupon,
            couponConventionEndOfMonthConvention: configItemDetails.couponConventionEndOfMonthConvention,
            couponConventionTreasuryTermCouponBase: configItemDetails.couponConventionTreasuryTermCouponBase,
            couponConventionHolidayAdjustedCouponFlag: configItemDetails.couponConventionHolidayAdjustedCouponFlag,
            couponConventionPaymentType: configItemDetails.couponConventionPaymentType,
            couponConventionFixedRateDeCompounding: configItemDetails.couponConventionFixedRateDeCompounding,
            couponConventionInclExclOneDay: configItemDetails.couponConventionInclExclOneDay,
            couponConventionSequenceConvention: configItemDetails.couponConventionSequenceConvention,
            oddCouponsAndRedempOddConvLastCoupon: configItemDetails.oddCouponsAndRedempOddConvLastCoupon,
            oddCouponsAndRedempOddConvLastRedeption: configItemDetails.oddCouponsAndRedempOddConvLastRedeption,
            sequenceConventionRedemption: configItemDetails.sequenceConventionRedemption,
            couponConventionsDayCount: configItemDetails.couponConventionsDayCount,
            accruedInterestConventionsInterestType: configItemDetails.accruedInterestConventionsInterestType,
            accruedInterestConventionsTreasuryProduct: configItemDetails.accruedInterestConventionsTreasuryProduct,
            accruedInterestConventionsDayCountConvention: configItemDetails.accruedInterestConventionsDayCountConvention,
            accruedInterestConventionsCalculationMethod: configItemDetails.accruedInterestConventionsCalculationMethod,
            floatingRatesReferenceRate: configItemDetails.floatingRatesReferenceRate,
            floatingRatesSpreadRate: configItemDetails.floatingRatesSpreadRate,
            interestLookBackPeriod: configItemDetails.interestLookBackPeriod,
            interestMultiplierFactor: configItemDetails.interestMultiplierFactor,
            interestAdjustmentFixingDays: configItemDetails.interestAdjustmentFixingDays,
            defaultFixingDate: configItemDetails.defaultFixingDate,
            defaultFixingRate: configItemDetails.defaultFixingRate,
            fixingTerm: configItemDetails.fixingTerm,
            fixingUnits: configItemDetails.fixingUnits,
            rateResetHolidayCalender: configItemDetails.rateResetHolidayCalender,
            compoundingConvention: configItemDetails.compoundingConvention,
            spreadConventionOrCompounding: configItemDetails.spreadConventionOrCompounding,
            couponRateMinimum: configItemDetails.couponRateMinimum,
            couponRateMaximum: configItemDetails.couponRateMaximum,
            alternativeSecurityIdIdentificationSystem: configItemDetails.alternativeSecurityIdIdentificationSystem,
            alternativeSecurityIdLongSecurityName: configItemDetails.alternativeSecurityIdLongSecurityName,
            alternativeSecurityIdCusip: configItemDetails.alternativeSecurityIdCusip,
            alternativeSecurityIdIsin: configItemDetails.alternativeSecurityIdIsin,
            putCalls: configItemDetails.putCalls,
            clientSpecificFields: configItemDetails.clientSpecificFields,
            attachments: configItemDetails.attachments,
            comments: configItemDetails.comments,
            changedByUser: configItemDetails.changedByUser,
            changedDate: configItemDetails.changedDate,
            createdByUser: configItemDetails.createdByUser,
            isDeleted: configItemDetails.isDeleted,
            deletedBy: configItemDetails.deletedBy,
            deleteReason: configItemDetails.deleteReason,
            actionItemId: configItemDetails._id,
            action: helper.sysConst.permissionAccessTypes.DELETE,
            actionDate: new Date(),
            actionBy: req.appCurrentUserData._id,
        }, {session: session});
        await auditData.save();

        await session.commitTransaction();

        br.sendSuccess(res, configItemDetails, 'Bond Security deleted successfully!');
    } catch (error) {

        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        br.sendServerError(res, {});

    } finally {
        await session.endSession();
    }
});

/**
 * @swagger
 * /api/v1/bond/bulk/delete:
 *  delete:
 *      summary: delete Bond Securities details by list id
 *      tags: [Bond]
 *      parameters:
 *      - name: ids
 *        in: query
 *        description: Array of Bond Id
 *        schema:
 *          type: array
 *          items:
 *              type: string
 *      - name: deleteReason
 *        in: query
 *        description: delete reason
 *        default: 'N/A'
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.delete("/bulk/delete", authUser, bondSecurityMiddleware.canDelete, async (req, res) => {
    let session = await mongo.startSession();

    try {
        if (Array.isArray(req.query.ids) && req.query.ids.length > 0) {
            let total = req.query.ids.length;
            let items = 0;

            for (let id in req.query.ids) {

                if (!helper.isValidObjectId()) {
                    logger.error(`Bulk Delete Bond Security with id => ${id} is and Invalid id!`);
                } else {
                    let configItemDetails = await BondSecurityModel.find({_id: id, isDeleted: false});

                    if (configItemDetails.length === 0) {
                        logger.error(`Bond Security with id => ${id} not found or deleted!`);
                    } else {
                        await session.startTransaction();

                        await BondSecurityModel.updateOne({_id: id, isDeleted: false}, {
                            isDeleted: true,
                            deletedBy: req.appCurrentUserData._id,
                            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
                        }).session(session);

                        configItemDetails = await BondSecurityModel.find({_id: id}).session(session);
                        configItemDetails = configItemDetails[0];

                        const auditData = new BondSecurityModel({
                            securityId: configItemDetails.securityId,
                            ISIN: configItemDetails.ISIN,
                            userDefinedSecurityId: configItemDetails.userDefinedSecurityId,
                            name: configItemDetails.name,
                            securityCode: configItemDetails.securityCode,
                            currency: configItemDetails.currency,
                            paymentHolidayCalender: configItemDetails.paymentHolidayCalender,
                            exchange: configItemDetails.exchange,
                            quoted: configItemDetails.quoted,
                            minTradeVolume: configItemDetails.minTradeVolume,
                            volume: configItemDetails.volume,
                            issuer: configItemDetails.issuer,
                            issueDate: configItemDetails.issueDate,
                            issuePrice: configItemDetails.issuePrice,
                            redemptionPrice: configItemDetails.redemptionPrice,
                            redemptionCurrency: configItemDetails.redemptionCurrency,
                            interestType: configItemDetails.interestType,
                            couponRate: configItemDetails.couponRate,
                            maturityDate: configItemDetails.maturityDate,
                            structure: configItemDetails.structure,
                            firstRedemptionDate: configItemDetails.firstRedemptionDate,
                            couponTerm: configItemDetails.couponTerm,
                            couponTermUnit: configItemDetails.couponTermUnit,
                            redemptionTerm: configItemDetails.redemptionTerm,
                            redemptionTermUnit: configItemDetails.redemptionTermUnit,
                            inceptionRedemptionRate: configItemDetails.inceptionRedemptionRate,
                            currentPoolFactor: configItemDetails.currentPoolFactor,
                            firstCouponPaymentDate: configItemDetails.firstCouponPaymentDate,
                            quotation: configItemDetails.quotation,
                            settlementDays: configItemDetails.settlementDays,
                            quoteType: configItemDetails.quoteType,
                            quotingLotSize: configItemDetails.quotingLotSize,
                            quotingFaceValue: configItemDetails.quotingFaceValue,
                            couponConventionDayCount: configItemDetails.couponConventionDayCount,
                            couponConventionPaymentDayConvention: configItemDetails.couponConventionPaymentDayConvention,
                            couponConventionTreasuryTermCoupon: configItemDetails.couponConventionTreasuryTermCoupon,
                            couponConventionEndOfMonthConvention: configItemDetails.couponConventionEndOfMonthConvention,
                            couponConventionTreasuryTermCouponBase: configItemDetails.couponConventionTreasuryTermCouponBase,
                            couponConventionHolidayAdjustedCouponFlag: configItemDetails.couponConventionHolidayAdjustedCouponFlag,
                            couponConventionPaymentType: configItemDetails.couponConventionPaymentType,
                            couponConventionFixedRateDeCompounding: configItemDetails.couponConventionFixedRateDeCompounding,
                            couponConventionInclExclOneDay: configItemDetails.couponConventionInclExclOneDay,
                            couponConventionSequenceConvention: configItemDetails.couponConventionSequenceConvention,
                            oddCouponsAndRedempOddConvLastCoupon: configItemDetails.oddCouponsAndRedempOddConvLastCoupon,
                            oddCouponsAndRedempOddConvLastRedeption: configItemDetails.oddCouponsAndRedempOddConvLastRedeption,
                            sequenceConventionRedemption: configItemDetails.sequenceConventionRedemption,
                            couponConventionsDayCount: configItemDetails.couponConventionsDayCount,
                            accruedInterestConventionsInterestType: configItemDetails.accruedInterestConventionsInterestType,
                            accruedInterestConventionsTreasuryProduct: configItemDetails.accruedInterestConventionsTreasuryProduct,
                            accruedInterestConventionsDayCountConvention: configItemDetails.accruedInterestConventionsDayCountConvention,
                            accruedInterestConventionsCalculationMethod: configItemDetails.accruedInterestConventionsCalculationMethod,
                            floatingRatesReferenceRate: configItemDetails.floatingRatesReferenceRate,
                            floatingRatesSpreadRate: configItemDetails.floatingRatesSpreadRate,
                            interestLookBackPeriod: configItemDetails.interestLookBackPeriod,
                            interestMultiplierFactor: configItemDetails.interestMultiplierFactor,
                            interestAdjustmentFixingDays: configItemDetails.interestAdjustmentFixingDays,
                            defaultFixingDate: configItemDetails.defaultFixingDate,
                            defaultFixingRate: configItemDetails.defaultFixingRate,
                            fixingTerm: configItemDetails.fixingTerm,
                            fixingUnits: configItemDetails.fixingUnits,
                            rateResetHolidayCalender: configItemDetails.rateResetHolidayCalender,
                            compoundingConvention: configItemDetails.compoundingConvention,
                            spreadConventionOrCompounding: configItemDetails.spreadConventionOrCompounding,
                            couponRateMinimum: configItemDetails.couponRateMinimum,
                            couponRateMaximum: configItemDetails.couponRateMaximum,
                            alternativeSecurityIdIdentificationSystem: configItemDetails.alternativeSecurityIdIdentificationSystem,
                            alternativeSecurityIdLongSecurityName: configItemDetails.alternativeSecurityIdLongSecurityName,
                            alternativeSecurityIdCusip: configItemDetails.alternativeSecurityIdCusip,
                            alternativeSecurityIdIsin: configItemDetails.alternativeSecurityIdIsin,
                            putCalls: configItemDetails.putCalls,
                            clientSpecificFields: configItemDetails.clientSpecificFields,
                            attachments: configItemDetails.attachments,
                            comments: configItemDetails.comments,
                            changedByUser: configItemDetails.changedByUser,
                            changedDate: configItemDetails.changedDate,
                            createdByUser: configItemDetails.createdByUser,
                            isDeleted: configItemDetails.isDeleted,
                            deletedBy: configItemDetails.deletedBy,
                            deleteReason: configItemDetails.deleteReason,
                            actionItemId: configItemDetails._id,
                            action: helper.sysConst.permissionAccessTypes.DELETE,
                            actionDate: new Date(),
                            actionBy: req.appCurrentUserData._id,
                        }, {session: session});
                        await auditData.save();

                        await session.commitTransaction();
                        items++;
                    }
                }
            }

            br.sendSuccess(res, {}, total === items ? 'All items deleted!' : 'Some of the items deleted kindly refresh the list to verify the deleted items!');
        } else {
            br.sendNotSuccessful(res, 'Nothing to delete! Please specify ids to delete items!');
        }
    } catch (error) {

        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        br.sendServerError(res, {});

    } finally {
        await session.endSession();
    }
});

module.exports = router;
