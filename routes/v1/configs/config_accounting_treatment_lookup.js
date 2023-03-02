const express = require("express");
const mongo = require("mongoose");
const moment = require('moment');
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const { bulkUploader } = require('../helper/file_uploader');
const IbAssetClassModel = require('../../../models/configIbAssetClassModel');
const PortfolioTypeModel = require('../../../models/configPortfolioTypeModel');
const AbFrameworkModel = require('../../../models/configAbFrameworkModel');
const CurrencyModel = require('../../../models/configCurrencyModel');
const AccountingTreatmentLookupModel = require('../../../models/configAccountingTreatmentLookupModel');
const AccountingTreatmentLookupAuditModel = require('../../../models/configAccountingTreatmentLookupAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const accountingTreatmentLookupMiddleware = require('../../../middleware/config_accounting_treatment_lookup_middleware');

/**
 * @swagger
 * /api/v1/config/accounting-treatment-lookup/add:
 *  post:
 *      summary: Add Accounting Treatment Lookup
 *      tags: [Config-Accounting Treatment Lookup]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          atlId:
 *                              type: string
 *                              default: ledger lookup 1
 *                          assetClass:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          portfolioType:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          accountingFramework:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          currency:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          accrualStatus:
 *                              type: string
 *                              default: Accrual
 *                          isActive:
 *                              type: boolean
 *                              default: true
 *                          clientSpecificField1:
 *                              type: string
 *                              default: ABC
 *                          clientSpecificField2:
 *                              type: string
 *                              default: ABC
 *                          accountingTreatment:
 *                              type: Integer
 *                              default: 1
 *                          accountingTreatmentDescription:
 *                              type: string
 *                              default: ABC
 *                          effectiveStartDate:
 *                              type: string
 *                              default: 2020-12-01
 *                          effectiveEndDate:
 *                              type: string
 *                              default: 2040-12-01
 *                          calenderActiveStatus:
 *                              type: boolean
 *                              default: true
 *                          ruleOrder:
 *                              type: Integer
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
router.post("/add", authUser, accountingTreatmentLookupMiddleware.canCreate, (req, res) => {
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
 * /api/v1/config/accounting-treatment-lookup/add/bulk:
 *  post:
 *      summary: Add Bulk Accounting Treatment Lookup using csv file
 *      tags: [Config-Accounting Treatment Lookup]
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
router.post("/add/bulk", authUser, accountingTreatmentLookupMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Accounting Treatment Lookup', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        atlId: 'required|string',
        assetClass: 'required|string',
        portfolioType: 'required|string',
        accountingFramework: 'required|string',
        currency: 'required|string',
        accrualStatus: 'required|string',
        isActive: 'required|boolean',
        clientSpecificField1: 'string',
        clientSpecificField2: 'string',
        accountingTreatment: 'required|integer|min:1|max:99',
        accountingTreatmentDescription: 'required|string',
        effectiveStartDate: 'required|string',
        effectiveEndDate: 'required|string',
        ruleOrder: 'required|integer|min:1|max:99',
        comments: 'string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    atlId: inputData.atlId.toString().trim(),
                    assetClass: inputData.assetClass.toString().trim(),
                    portfolioType: inputData.portfolioType.toString().trim(),
                    accountingFramework: inputData.accountingFramework.toString().trim(),
                    currency: inputData.currency.toString().trim(),
                    accrualStatus: inputData.accrualStatus.toString().trim(),
                    isActive: helper.getBoolean(inputData.accountingYearType),
                    clientSpecificField1: inputData.clientSpecificField1 !== undefined ? inputData.clientSpecificField1.toString().trim() : '',
                    clientSpecificField2: inputData.clientSpecificField2 !== undefined ? inputData.clientSpecificField2.toString().trim() : '',
                    accountingTreatment: parseInt(inputData.accountingTreatment),
                    accountingTreatmentDescription: inputData.accountingTreatmentDescription.toString().trim(),
                    effectiveStartDate: moment(inputData.effectiveStartDate),
                    effectiveEndDate: moment(inputData.effectiveEndDate),
                    ruleOrder: parseInt(inputData.ruleOrder),
                    comments: inputData.comments !== undefined ? inputData.comments.toString().trim() : '',
                };

                if (!helper.isValidObjectId(data.assetClass)) {
                    return callback(counter, false, 'assetClass is not a valid Ib Asset Id!');
                } else {
                    const itemDetails = await IbAssetClassModel
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

                if (!data.effectiveStartDate.isValid()) {
                    return callback(counter, false, 'effectiveStartDate is not a valid date!');
                } else {
                    data.effectiveStartDate = new Date(data.effectiveStartDate.format());
                }

                if (!data.effectiveEndDate.isValid()) {
                    return callback(counter, false, 'effectiveEndDate is not a valid date!');
                } else {
                    data.effectiveEndDate = new Date(data.effectiveEndDate.format());
                }

                const configFind = await AccountingTreatmentLookupModel.find({
                    atlId: data.atlId,
                    assetClass: data.assetClass,
                    portfolioType: data.portfolioType,
                    accountingFramework: data.accountingFramework,
                    currency: data.currency
                });

                if (configFind.length > 0) {
                    return callback(counter, false, 'Accounting Treatment Lookup is already '
                        + 'present with atlId => `'
                        + configFind[0].atlId
                        + '` and assetClass => `'
                        + configFind[0].assetClass
                        + '` and portfolioType => `'
                        + configFind[0].portfolioType
                        + '` and accountingFramework => `'
                        + configFind[0].accountingFramework
                        + '` and currency => `'
                        + configFind[0].currency + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new AccountingTreatmentLookupModel({
                    atlId: data.atlId,
                    assetClass: data.assetClass,
                    portfolioType: data.portfolioType,
                    accountingFramework: data.accountingFramework,
                    currency: data.currency,
                    accrualStatus: data.accrualStatus,
                    isActive: data.isActive,
                    clientSpecificField1: data.clientSpecificField1,
                    clientSpecificField2: data.clientSpecificField2,
                    accountingTreatment: data.accountingTreatment,
                    accountingTreatmentDescription: data.accountingTreatmentDescription,
                    effectiveStartDate: data.effectiveStartDate,
                    effectiveEndDate: data.effectiveEndDate,
                    ruleOrder: data.ruleOrder,
                    comments: data.comments,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new AccountingTreatmentLookupAuditModel({
                    atlId: ib.atlId,
                    assetClass: ib.assetClass,
                    portfolioType: ib.portfolioType,
                    accountingFramework: ib.accountingFramework,
                    currency: ib.currency,
                    accrualStatus: ib.accrualStatus,
                    isActive: ib.isActive,
                    clientSpecificField1: ib.clientSpecificField1,
                    clientSpecificField2: ib.clientSpecificField2,
                    accountingTreatment: ib.accountingTreatment,
                    accountingTreatmentDescription: ib.accountingTreatmentDescription,
                    effectiveStartDate: ib.effectiveStartDate,
                    effectiveEndDate: ib.effectiveEndDate,
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

                callback(counter, true, 'Accounting Treatment Lookup added successfully!', ib);

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
 * /api/v1/config/accounting-treatment-lookup/update/{id}:
 *  put:
 *      summary: Update Accounting Treatment Lookup by id
 *      tags: [Config-Accounting Treatment Lookup]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Accounting Treatment Lookup Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          atlId:
 *                              type: string
 *                              default: ledger lookup 1
 *                          assetClass:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          portfolioType:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          accountingFramework:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          currency:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          accrualStatus:
 *                              type: string
 *                              default: Accrual
 *                          isActive:
 *                              type: boolean
 *                              default: true
 *                          clientSpecificField1:
 *                              type: string
 *                              default: ABC
 *                          clientSpecificField2:
 *                              type: string
 *                              default: ABC
 *                          accountingTreatment:
 *                              type: Integer
 *                              default: 1
 *                          accountingTreatmentDescription:
 *                              type: string
 *                              default: ABC
 *                          effectiveStartDate:
 *                              type: string
 *                              default: 2020-12-01
 *                          effectiveEndDate:
 *                              type: string
 *                              default: 2040-12-01
 *                          calenderActiveStatus:
 *                              type: boolean
 *                              default: true
 *                          ruleOrder:
 *                              type: Integer
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
router.put("/update/:id", authUser, accountingTreatmentLookupMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        atlId: 'string',
        assetClass: 'string',
        portfolioType: 'string',
        accountingFramework: 'string',
        currency: 'string',
        accrualStatus: 'string',
        isActive: 'boolean',
        clientSpecificField1: 'string',
        clientSpecificField2: 'string',
        accountingTreatment: 'integer|min:1|max:99',
        accountingTreatmentDescription: 'string',
        effectiveStartDate: 'string',
        effectiveEndDate: 'string',
        ruleOrder: 'integer|min:1|max:99',
        comments: 'string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await AccountingTreatmentLookupModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Accounting Treatment Lookup with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.atlId !== undefined) {
                    data.atlId = req.body.atlId.toString().trim();
                }

                if (req.body.assetClass !== undefined) {
                    data.assetClass = req.body.assetClass.toString().trim();

                    if (!helper.isValidObjectId(data.assetClass)) {
                        return br.sendNotSuccessful(res, 'assetClass is not a valid Ib Asset Id!');
                    } else {
                        const itemDetails = await IbAssetClassModel
                            .find({_id: data.assetClass, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Ib Asset Id for assetClass => ' + data.assetClass + '!');
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
                            return br.sendNotSuccessful(res, 'Invalid Portfolio Type Id for portfolioType => ' + data.portfolioType + '!');
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
                        return br.sendNotSuccessful(res, 'currency is not a valid Currency Id!');
                    } else {
                        const itemDetails = await CurrencyModel
                            .find({_id: data.currency, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Currency Id for currency => ' + data.portfolioGroup + '!');
                        }
                    }
                }

                if (req.body.accrualStatus !== undefined) {
                    data.accrualStatus = req.body.accrualStatus.toString().trim();
                }

                if (req.body.isActive !== undefined) {
                    data.accountingYearType = helper.getBoolean(req.body.isActive);
                }

                if (req.body.clientSpecificField1 !== undefined) {
                    data.clientSpecificField1 = req.body.clientSpecificField1.toString().trim();
                }

                if (req.body.clientSpecificField2 !== undefined) {
                    data.clientSpecificField2 = req.body.clientSpecificField2.toString().trim();
                }

                if (req.body.accountingTreatment !== undefined) {
                    data.accountingTreatment = parseInt(req.body.accountingTreatment);
                }

                if (req.body.accountingTreatmentDescription !== undefined) {
                    data.accountingTreatmentDescription = req.body.accountingTreatmentDescription.toString().trim();
                }

                if (req.body.effectiveStartDate !== undefined) {
                    data.effectiveStartDate = moment(req.body.effectiveStartDate);

                    if (!data.effectiveStartDate.isValid()) {
                        return br.sendNotSuccessful(res, 'effectiveStartDate is not a valid date!');
                    } else {
                        data.effectiveStartDate = new Date(data.effectiveStartDate.format());
                    }
                }

                if (req.body.effectiveEndDate !== undefined) {
                    data.effectiveEndDate = moment(req.body.effectiveEndDate);

                    if (!data.effectiveEndDate.isValid()) {
                        return br.sendNotSuccessful(res, 'effectiveEndDate is not a valid date!');
                    } else {
                        data.effectiveEndDate = new Date(data.effectiveEndDate.format());
                    }
                }

                if (req.body.ruleOrder !== undefined) {
                    data.ruleOrder = parseInt(req.body.ruleOrder);
                }

                if (req.body.comments !== undefined) {
                    data.comments = req.body.comments.toString().trim();
                }

                let configFind = await AccountingTreatmentLookupModel.find({
                    _id: {
                        $nin: id
                    },
                    atlId: data.atlId !== undefined
                        ? data.atlId
                        : configItem.atlId,
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
                        : configItem.currency
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Accounting Treatment Lookup is already '
                        + 'present with atlId => `'
                        + configFind[0].atlId
                        + '` and assetClass => `'
                        + configFind[0].assetClass
                        + '` and portfolioType => `'
                        + configFind[0].portfolioType
                        + '` and accountingFramework => `'
                        + configFind[0].accountingFramework
                        + '` and currency => `'
                        + configFind[0].currency + ' !',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await AccountingTreatmentLookupModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await AccountingTreatmentLookupModel.find({
                    _id: id,
                    isDeleted: false
                }).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new AccountingTreatmentLookupAuditModel({
                    atlId: configItemDetails.atlId,
                    assetClass: configItemDetails.assetClass,
                    portfolioType: configItemDetails.portfolioType,
                    accountingFramework: configItemDetails.accountingFramework,
                    currency: configItemDetails.currency,
                    accrualStatus: configItemDetails.accrualStatus,
                    isActive: configItemDetails.isActive,
                    clientSpecificField1: configItemDetails.clientSpecificField1,
                    clientSpecificField2: configItemDetails.clientSpecificField2,
                    accountingTreatment: configItemDetails.accountingTreatment,
                    accountingTreatmentDescription: configItemDetails.accountingTreatmentDescription,
                    effectiveStartDate: configItemDetails.effectiveStartDate,
                    effectiveEndDate: configItemDetails.effectiveEndDate,
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

                br.sendSuccess(res, configItemDetails, 'Accounting Treatment Lookup updated successfully!');

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
 * /api/v1/config/accounting-treatment-lookup/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Accounting Treatment Lookup]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, accountingTreatmentLookupMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'atlId',
                'assetClass',
                'portfolioType',
                'accountingFramework',
                'currency',
                'accrualStatus',
                'isActive',
                'clientSpecificField1',
                'clientSpecificField2',
                'accountingTreatment',
                'accountingTreatmentDescription',
                'effectiveStartDate',
                'effectiveEndDate',
                'ruleOrder',
                'comments',
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configAccountingTreatmentLookupSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/accounting-treatment-lookup/get-all:
 *  get:
 *      summary: Get all Accounting Treatment Lookup
 *      tags: [Config-Accounting Treatment Lookup]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Accounting Treatment Lookup using atlId
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, accountingTreatmentLookupMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.atlId = {
                $regex: new RegExp('^' + req.query.search, 'i'),
            }
        }

        let assets = await AccountingTreatmentLookupModel.find(filter).populate(['assetClass', 'portfolioType', 'accountingFramework', 'currency']);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/accounting-treatment-lookup/get/{id}:
 *  get:
 *      summary: get Accounting Treatment Lookup details by id
 *      tags: [Config-Accounting Treatment Lookup]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Accounting Treatment Lookup Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, accountingTreatmentLookupMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await AccountingTreatmentLookupModel.find({
            _id: id,
            isDeleted: false
        }).populate(['assetClass', 'portfolioType', 'accountingFramework', 'currency']);

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Accounting Treatment Lookup with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/accounting-treatment-lookup/delete/{id}:
 *  delete:
 *      summary: delete Accounting Treatment Lookup details by id
 *      tags: [Config-Accounting Treatment Lookup]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Accounting Treatment Lookup Id
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
router.delete("/delete/:id", authUser, accountingTreatmentLookupMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await AccountingTreatmentLookupModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Accounting Treatment Lookup with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await AccountingTreatmentLookupModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await AccountingTreatmentLookupModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new AccountingTreatmentLookupAuditModel({
            atlId: configItemDetails.atlId,
            assetClass: configItemDetails.assetClass,
            portfolioType: configItemDetails.portfolioType,
            accountingFramework: configItemDetails.accountingFramework,
            currency: configItemDetails.currency,
            accrualStatus: configItemDetails.accrualStatus,
            isActive: configItemDetails.isActive,
            clientSpecificField1: configItemDetails.clientSpecificField1,
            clientSpecificField2: configItemDetails.clientSpecificField2,
            accountingTreatment: configItemDetails.accountingTreatment,
            accountingTreatmentDescription: configItemDetails.accountingTreatmentDescription,
            effectiveStartDate: configItemDetails.effectiveStartDate,
            effectiveEndDate: configItemDetails.effectiveEndDate,
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

        br.sendSuccess(res, configItemDetails, 'Accounting Treatment Lookup deleted successfully!');
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
