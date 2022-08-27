const express = require("express");
const mongo = require("mongoose");
const moment = require('moment');
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const { bulkUploader } = require('../helper/file_uploader');
const IbAssetModel = require('../../../models/configIbAssetClassModel');
const PortfolioTypeModel = require('../../../models/configPortfolioTypeModel');
const AbFrameworkModel = require('../../../models/configAbFrameworkModel');
const CurrencyModel = require('../../../models/configCurrencyModel');
const AccountingCalenderModel = require('../../../models/configAccountingCalenderModel');
const LedgerLookupModel = require('../../../models/configLedgerLookupModel');
const LedgerLookupAuditModel = require('../../../models/configLedgerLookupAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const ledgerLookupMiddleware = require('../../../middleware/config_ledger_lookup_middleware');

/**
 * @swagger
 * /api/v1/config/ledger-lookup/add:
 *  post:
 *      summary: Add Ledger Lookup
 *      tags: [Config-Ledger Lookup]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          ledgerId:
 *                              type: string
 *                              default: US-GAAP
 *                          ledgerName:
 *                              type: string
 *                              default: US-GAAP
 *                          assetClass:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          portfolioType:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          accountingFramework:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          currency:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          isActive:
 *                              type: boolean
 *                              default: true
 *                          chartOfAccountsReference:
 *                              type: string
 *                              default: COA 1
 *                          clientSpecificField1:
 *                              type: string
 *                              default: PCT
 *                          clientSpecificField2:
 *                              type: string
 *                              default: PCT
 *                          accountingCalender:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          ledgerStartDate:
 *                              type: string
 *                              default: 1900-01-01
 *                          ledgerEndDate:
 *                              type: string
 *                              default: 2029-12-01
 *                          ledgerType:
 *                              type: string
 *                              default: Child
 *                              enum: [Parent, Child]
 *                          parentLedger:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          ruleOrder:
 *                              type: integer
 *                              default: 10
 *                          comments:
 *                              type: string
 *                              default: Rule 1
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, ledgerLookupMiddleware.canCreate, (req, res) => {
    insertData(req, req.body, 0, (counter, isSuccess, msg, data = {}) => {
        isSuccess
            ? br.sendSuccess(res, data, msg)
            : br.sendNotSuccessful(res, msg, data);
    }, (counter, err) => {
        br.sendServerError(res, err);
    });
});

/**
 * @swagger
 * /api/v1/config/ledger-lookup/add/bulk:
 *  post:
 *      summary: Add Bulk Ledger Lookup using csv file
 *      tags: [Config-Ledger Lookup]
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
router.post("/add/bulk", authUser, ledgerLookupMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Ledger Lookup', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        ledgerId: 'required|string',
        ledgerName: 'required|string',
        assetClass: 'required|string',
        portfolioType: 'required|string',
        accountingFramework: 'required|string',
        currency: 'required|string',
        isActive: 'required|boolean',
        chartOfAccountsReference: 'required|string',
        clientSpecificField1: 'required|string',
        clientSpecificField2: 'required|string',
        accountingCalender: 'required|string',
        ledgerStartDate: 'required|string',
        ledgerEndDate: 'required|string',
        ledgerType: 'required|string',
        parentLedger: 'nullable',
        ruleOrder: 'required|integer',
        comments: 'string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    ledgerId: inputData.ledgerId.toString().trim(),
                    ledgerName: inputData.ledgerName.toString().trim(),
                    assetClass: inputData.assetClass.toString().trim(),
                    portfolioType: inputData.portfolioType.toString().trim(),
                    accountingFramework: inputData.accountingFramework.toString().trim(),
                    currency: inputData.currency.toString().trim(),
                    isActive: helper.getBoolean(inputData.isActive),
                    chartOfAccountsReference: inputData.chartOfAccountsReference.toString().trim(),
                    clientSpecificField1: inputData.clientSpecificField1.toString().trim(),
                    clientSpecificField2: inputData.clientSpecificField2.toString().trim(),
                    accountingCalender: inputData.accountingCalender.toString().trim(),
                    ledgerStartDate: moment(inputData.ledgerStartDate),
                    ledgerEndDate: moment(inputData.ledgerEndDate),
                    ledgerType: inputData.ledgerType.toString().trim(),
                    parentLedger: inputData.parentLedger,
                    ruleOrder: parseInt(inputData.ruleOrder),
                    comments: inputData.comments !== undefined ? inputData.comments.toString().trim() : '',
                };

                if (!helper.isValidObjectId(data.assetClass)) {
                    return callback(counter, false, 'assetClass is not a valid Ib Asset Id!');
                } else {
                    const itemDetails = await IbAssetModel
                        .find({_id: data.assetClass, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Ib Asset Id for assetClass => ' + data.assetClass + '!');
                    }
                }

                if (!helper.isValidObjectId(data.portfolioType)) {
                    return callback(counter, false, 'portfolioType is not a valid Portfolio Type Id!');
                } else {
                    const itemDetails = await PortfolioTypeModel
                        .find({_id: data.portfolioType, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Portfolio Type Id for portfolioType => ' + data.portfolioType + '!');
                    }
                }

                if (!helper.isValidObjectId(data.accountingFramework)) {
                    return callback(counter, false, 'accountingFramework is not a valid Ab Framework Id!');
                } else {
                    const itemDetails = await AbFrameworkModel
                        .find({_id: data.accountingFramework, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Ab Framework Id for accountingFramework => ' + data.accountingFramework + '!');
                    }
                }

                if (!helper.isValidObjectId(data.currency)) {
                    return callback(counter, false, 'currency is not a valid Currency Id!');
                } else {
                    const itemDetails = await CurrencyModel
                        .find({_id: data.currency, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Currency Id for currency => ' + data.currency + '!');
                    }
                }

                if (!helper.isValidObjectId(data.accountingCalender)) {
                    return callback(counter, false, 'accountingCalender is not a valid Accounting Calender Id !');
                } else {
                    const itemDetails = await AccountingCalenderModel
                        .find({_id: data.accountingCalender, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Accounting Calender Id for accountingCalender => ' + data.accountingCalender + '!');
                    }
                }

                if (!data.ledgerStartDate.isValid()) {
                    return callback(counter, false, 'ledgerStartDate is not a valid date!');
                } else {
                    data.ledgerStartDate = new Date(data.ledgerStartDate.format());
                }

                if (!data.ledgerEndDate.isValid()) {
                    return callback(counter, false, 'ledgerEndDate is not a valid date!');
                } else {
                    data.ledgerEndDate = new Date(data.ledgerEndDate.format());
                }

                if (!helper.isObjectContainsKey(helper.sysConst.ledgerTypes, data.ledgerType)) {
                    return callback(counter, false, 'ledgerType is not valid!');
                }

                if (data.ledgerType === helper.sysConst.ledgerTypes.Child && !helper.isValidObjectId(data.parentLedger)) {
                    return callback(counter, false, 'parentLedger is not a valid Ledger Lookup Id!');
                } else if(data.ledgerType === helper.sysConst.ledgerTypes.Child && helper.isValidObjectId(data.parentLedger)) {
                    const itemDetails = await LedgerLookupModel
                        .find({
                            _id: data.parentLedger,
                            isDeleted: false,
                            ledgerType: helper.sysConst.ledgerTypes.Parent
                        });

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Ledger Lookup Id for parentLedger => ' + data.accountingCalender + '!');
                    }
                }

                if( data.ruleOrder < 0 || data.ruleOrder > 99 ){
                    return callback(counter, false, 'ruleOrder can not be less than 0 or greater than 99!');
                }

                const configFind = await LedgerLookupModel.find({
                    ledgerId: data.ledgerId,
                    ledgerName: data.ledgerName,
                    assetClass: data.assetClass,
                    portfolioType: data.portfolioType,
                    accountingFramework: data.accountingFramework,
                    currency: data.currency,
                    accountingCalender: data.accountingCalender,
                }).populate([
                    'assetClass',
                    'portfolioType',
                    'accountingFramework',
                    'currency',
                    'accountingCalender'
                ]);

                if (configFind.length > 0) {
                    return callback(counter, false, 'Ledger Lookup is already '
                        + 'present with ledgerId => `'
                        + configFind[0].ledgerId
                        + '` and ledgerName => `'
                        + configFind[0].ledgerName
                        + '` and assetClass => `'
                        + configFind[0].assetClass.assetClass
                        + '` and portfolioType => `'
                        + configFind[0].portfolioType.portfolioType
                        + '` and accountingFramework => `'
                        + configFind[0].accountingFramework.accountingFramework
                        + '` and currency => `'
                        + configFind[0].currency.currencyName
                        + '` and accountingCalender => `'
                        + configFind[0].accountingCalender.acName + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new LedgerLookupModel({
                    ledgerId: data.ledgerId,
                    ledgerName: data.ledgerName,
                    assetClass: data.assetClass,
                    portfolioType: data.portfolioType,
                    accountingFramework: data.accountingFramework,
                    currency: data.currency,
                    isActive: data.isActive,
                    chartOfAccountsReference: data.chartOfAccountsReference,
                    clientSpecificField1: data.clientSpecificField1,
                    clientSpecificField2: data.clientSpecificField2,
                    accountingCalender: data.accountingCalender,
                    ledgerStartDate: data.ledgerStartDate,
                    ledgerEndDate: data.ledgerEndDate,
                    ledgerType: data.ledgerType,
                    parentLedger: data.parentLedger,
                    ruleOrder: data.ruleOrder,
                    comments: data.comments,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new LedgerLookupAuditModel({
                    ledgerId: ib.ledgerId,
                    ledgerName: ib.ledgerName,
                    assetClass: ib.assetClass,
                    portfolioType: ib.portfolioType,
                    accountingFramework: ib.accountingFramework,
                    currency: ib.currency,
                    isActive: ib.isActive,
                    chartOfAccountsReference: ib.chartOfAccountsReference,
                    clientSpecificField1: ib.clientSpecificField1,
                    clientSpecificField2: ib.clientSpecificField2,
                    accountingCalender: ib.accountingCalender,
                    ledgerStartDate: ib.ledgerStartDate,
                    ledgerEndDate: ib.ledgerEndDate,
                    ledgerType: ib.ledgerType,
                    parentLedger: ib.parentLedger,
                    ruleOrder: ib.ruleOrder,
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

                await session.commitTransaction();

                callback(counter, true, 'Ledger Lookup added successfully!', ib);

            } catch (err) {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                onError(counter, err);
            } finally {
                await session.endSession();
            }
        }
    });
}

/**
 * @swagger
 * /api/v1/config/ledger-lookup/update/{id}:
 *  put:
 *      summary: Update Ledger Lookup by id
 *      tags: [Config-Ledger Lookup]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ledger Lookup Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          ledgerId:
 *                              type: string
 *                              default: US-GAAP
 *                          ledgerName:
 *                              type: string
 *                              default: US-GAAP
 *                          assetClass:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          portfolioType:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          accountingFramework:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          currency:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          isActive:
 *                              type: boolean
 *                              default: true
 *                          chartOfAccountsReference:
 *                              type: string
 *                              default: COA 1
 *                          clientSpecificField1:
 *                              type: string
 *                              default: PCT
 *                          clientSpecificField2:
 *                              type: string
 *                              default: PCT
 *                          accountingCalender:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          ledgerStartDate:
 *                              type: string
 *                              default: 1900-01-01
 *                          ledgerEndDate:
 *                              type: string
 *                              default: 2029-12-01
 *                          ledgerType:
 *                              type: string
 *                              default: Child
 *                              enum: [Parent, Child]
 *                          parentLedger:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          ruleOrder:
 *                              type: integer
 *                              default: 10
 *                          comments:
 *                              type: string
 *                              default: Rule 1
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, ledgerLookupMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        ledgerId: 'string',
        ledgerName: 'string',
        assetClass: 'string',
        portfolioType: 'string',
        accountingFramework: 'string',
        currency: 'string',
        isActive: 'boolean',
        chartOfAccountsReference: 'string',
        clientSpecificField1: 'string',
        clientSpecificField2: 'string',
        accountingCalender: 'string',
        ledgerStartDate: 'string',
        ledgerEndDate: 'string',
        ledgerType: 'string',
        parentLedger: 'nullable',
        ruleOrder: 'integer',
        comments: 'string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await LedgerLookupModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Ledger Lookup with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.ledgerId !== undefined) {
                    data.ledgerId = req.body.ledgerId.toString().trim();
                }

                if (req.body.ledgerName !== undefined) {
                    data.ledgerName = req.body.ledgerName.toString().trim();
                }

                if (req.body.assetClass !== undefined) {
                    data.assetClass = req.body.assetClass.toString().trim();

                    if (!helper.isValidObjectId(data.assetClass)) {
                        return br.sendNotSuccessful(res, 'assetClass is not a valid Ib Asset Id!');
                    } else {
                        const itemDetails = await IbAssetModel
                            .find({_id: data.assetClass, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Ib Asset Id for assetClass => ' + data.instrumentType + '!');
                        }
                    }
                }

                if (req.body.portfolioType !== undefined) {
                    data.portfolioType = req.body.portfolioType.toString().trim();

                    if (!helper.isValidObjectId(data.portfolioType)) {
                        return br.sendNotSuccessful(res, 'portfolioType is not a valid Portfolio Type Id!');
                    } else {
                        const itemDetails = await PortfolioTypeModel
                            .find({_id: data.portfolioType, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid IPortfolio Type Id for portfolioType => ' + data.portfolioType + '!');
                        }
                    }
                }

                if (req.body.accountingFramework !== undefined) {
                    data.accountingFramework = req.body.accountingFramework.toString().trim();

                    if (!helper.isValidObjectId(data.accountingFramework)) {
                        return br.sendNotSuccessful(res, 'accountingFramework is not a valid Ab Framework Id!');
                    } else {
                        const itemDetails = await AbFrameworkModel
                            .find({_id: data.accountingFramework, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Ab Framework Id for accountingFramework => ' + data.accountingFramework + '!');
                        }
                    }
                }

                if (req.body.currency !== undefined) {
                    data.currency = req.body.currency.toString().trim();

                    if (!helper.isValidObjectId(data.currency)) {
                        return br.sendNotSuccessful(res, 'currency is not a valid Ib Asset Id!');
                    } else {
                        const itemDetails = await CurrencyModel
                            .find({_id: data.currency, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Ib Asset Id for currency => ' + data.currency + '!');
                        }
                    }
                }

                if (req.body.isActive !== undefined) {
                    data.isActive = helper.getBoolean(req.body.isActive);
                }

                if (req.body.chartOfAccountsReference !== undefined) {
                    data.chartOfAccountsReference = req.body.chartOfAccountsReference.toString().trim();
                }

                if (req.body.clientSpecificField1 !== undefined) {
                    data.clientSpecificField1 = req.body.clientSpecificField1.toString().trim();
                }

                if (req.body.clientSpecificField2 !== undefined) {
                    data.clientSpecificField2 = req.body.clientSpecificField2.toString().trim();
                }

                if (req.body.accountingCalender !== undefined) {
                    data.accountingCalender = req.body.accountingCalender.toString().trim();

                    if (!helper.isValidObjectId(data.accountingCalender)) {
                        return br.sendNotSuccessful(res, 'accountingCalender is not a valid Accounting Calender Id!');
                    } else {
                        const itemDetails = await AccountingCalenderModel
                            .find({_id: data.accountingCalender, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Accounting Calender Id for accountingCalender => ' + data.accountingCalender + '!');
                        }
                    }
                }

                if (req.body.ledgerStartDate !== undefined) {
                    data.ledgerStartDate = moment(req.body.ledgerStartDate);

                    if (!data.ledgerStartDate.isValid()) {
                        return br.sendNotSuccessful(res, 'ledgerStartDate is not a valid date!');
                    } else {
                        data.ledgerStartDate = new Date(data.ledgerStartDate.format());
                    }
                }

                if (req.body.ledgerEndDate !== undefined) {
                    data.ledgerEndDate = moment(req.body.ledgerEndDate);

                    if (!data.ledgerEndDate.isValid()) {
                        return br.sendNotSuccessful(res, 'ledgerEndDate is not a valid date!');
                    } else {
                        data.ledgerEndDate = new Date(data.ledgerEndDate.format());
                    }
                }

                if (req.body.ledgerType !== undefined) {
                    data.ledgerType = req.body.ledgerType.toString().trim();

                    if (!helper.isObjectContainsKey(helper.sysConst.ledgerTypes, data.ledgerType)) {
                        return br.sendNotSuccessful(res, 'ledgerType is not valid!');
                    }
                }

                if(data.ledgerType !== undefined && data.ledgerType === helper.sysConst.ledgerTypes.Child && req.body.parentLedger !== undefined){
                    data.parentLedger = req.body.parentLedger.toString().trim();

                    if (!helper.isValidObjectId(data.parentLedger)) {
                        return br.sendNotSuccessful(res, 'parentLedger is not a valid Ledger Lookup Id!');
                    } else {
                        const itemDetails = await LedgerLookupModel
                            .find({_id: data.parentLedger, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Ledger Lookup Id for parentLedger => ' + data.parentLedger + '!');
                        }
                    }
                }

                if(req.body.ruleOrder !== undefined){
                    data.ruleOrder = parseInt(req.body.ruleOrder);

                    if( data.ruleOrder < 0 || data.ruleOrder > 99 ){
                        return br.sendNotSuccessful(res, 'ruleOrder can not be less than 0 or greater than 99!');
                    }
                }

                if (req.body.comments !== undefined) {
                    data.comments = req.body.comments.toString().trim();
                }

                let configFind = await LedgerLookupModel.find({
                    _id: {
                        $nin: id
                    },
                    ledgerId: data.ledgerId !== undefined
                        ? data.ledgerId
                        : configItem.ledgerId,
                    ledgerName: data.ledgerName !== undefined
                        ? data.ledgerName
                        : configItem.ledgerName,
                    assetClass: data.assetClass !== undefined
                        ? data.assetClass
                        : configItem.assetClass,
                    portfolioType: data.portfolioType !== undefined
                        ? data.portfolioType
                        : configItem.portfolioType,
                    accountingFramework: data.accountingFramework !== undefined
                        ? data.accountingFramework
                        : configItem.accountingFramework,
                    currency: data.currency !== undefined
                        ? data.currency
                        : configItem.currency,
                    accountingCalender: data.accountingCalender !== undefined
                        ? data.accountingCalender
                        : configItem.accountingCalender
                }).populate([
                    'assetClass',
                    'portfolioType',
                    'accountingFramework',
                    'currency',
                    'accountingCalender'
                ]);

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Ledger Lookup is already '
                        + 'present with ledgerId => `'
                        + configFind[0].ledgerId
                        + '` and ledgerName => `'
                        + configFind[0].ledgerName
                        + '` and assetClass => `'
                        + configFind[0].assetClass.assetClass
                        + '` and portfolioType => `'
                        + configFind[0].portfolioType.portfolioType
                        + '` and accountingFramework => `'
                        + configFind[0].accountingFramework.accountingFramework
                        + '` and currency => `'
                        + configFind[0].currency.currencyName
                        + '` and accountingCalender => `'
                        + configFind[0].accountingCalender.acName + ' !',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await LedgerLookupModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await LedgerLookupModel.find({
                    _id: id,
                    isDeleted: false
                }).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new LedgerLookupAuditModel({
                    ledgerId: configItemDetails.ledgerId,
                    ledgerName: configItemDetails.ledgerName,
                    assetClass: configItemDetails.assetClass,
                    portfolioType: configItemDetails.portfolioType,
                    accountingFramework: configItemDetails.accountingFramework,
                    currency: configItemDetails.currency,
                    isActive: configItemDetails.isActive,
                    chartOfAccountsReference: configItemDetails.chartOfAccountsReference,
                    clientSpecificField1: configItemDetails.clientSpecificField1,
                    clientSpecificField2: configItemDetails.clientSpecificField2,
                    accountingCalender: configItemDetails.accountingCalender,
                    ledgerStartDate: configItemDetails.ledgerStartDate,
                    ledgerEndDate: configItemDetails.ledgerEndDate,
                    ledgerType: configItemDetails.ledgerType,
                    parentLedger: configItemDetails.parentLedger,
                    ruleOrder: configItemDetails.ruleOrder,
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

                await session.commitTransaction();

                br.sendSuccess(res, configItemDetails, 'Ledger Lookup updated successfully!');

            } catch (error) {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                br.sendServerError(res, error);
            } finally {
                await session.endSession();
            }
        }
    });
});

/**
 * @swagger
 * /api/v1/config/ledger-lookup/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Ledger Lookup]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, ledgerLookupMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'ledgerId',
                'ledgerName',
                'assetClass',
                'portfolioType',
                'accountingFramework',
                'currency',
                'isActive',
                'chartOfAccountsReference',
                'clientSpecificField1',
                'clientSpecificField2',
                'accountingCalender',
                'ledgerStartDate',
                'ledgerEndDate',
                'ledgerType',
                'parentLedger',
                'ruleOrder',
                'comments',
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configLedgerLookupInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ledger-lookup/get-all:
 *  get:
 *      summary: Get all Ledger Lookup
 *      tags: [Config-Ledger Lookup]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Ledger Lookup using ledgerName
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, ledgerLookupMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.ledgerName = {
                $regex: new RegExp('^' + req.query.search, 'i'),
            }
        }

        let assets = await LedgerLookupModel.find(filter).populate([
            'assetClass',
            'portfolioType',
            'accountingFramework',
            'currency',
            'accountingCalender',
            'parentLedger'
        ]);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ledger-lookup/get/{id}:
 *  get:
 *      summary: get Ledger Lookup details by id
 *      tags: [Config-Ledger Lookup]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ledger Lookup Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, ledgerLookupMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await LedgerLookupModel.find({
            _id: id,
            isDeleted: false
        }).populate([
            'assetClass',
            'portfolioType',
            'accountingFramework',
            'currency',
            'accountingCalender',
            'parentLedger'
        ]);

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Ledger Lookup with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ledger-lookup/delete/{id}:
 *  delete:
 *      summary: delete Ledger Lookup details by id
 *      tags: [Config-Ledger Lookup]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ledger Lookup Id
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
router.delete("/delete/:id", authUser, ledgerLookupMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await LedgerLookupModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Ledger Lookup with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await LedgerLookupModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await LedgerLookupModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new LedgerLookupAuditModel({
            ledgerId: configItemDetails.ledgerId,
            ledgerName: configItemDetails.ledgerName,
            assetClass: configItemDetails.assetClass,
            portfolioType: configItemDetails.portfolioType,
            accountingFramework: configItemDetails.accountingFramework,
            currency: configItemDetails.currency,
            isActive: configItemDetails.isActive,
            chartOfAccountsReference: configItemDetails.chartOfAccountsReference,
            clientSpecificField1: configItemDetails.clientSpecificField1,
            clientSpecificField2: configItemDetails.clientSpecificField2,
            accountingCalender: configItemDetails.accountingCalender,
            ledgerStartDate: configItemDetails.ledgerStartDate,
            ledgerEndDate: configItemDetails.ledgerEndDate,
            ledgerType: configItemDetails.ledgerType,
            parentLedger: configItemDetails.parentLedger,
            ruleOrder: configItemDetails.ruleOrder,
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

        br.sendSuccess(res, configItemDetails, 'Ledger Lookup deleted successfully!');
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
