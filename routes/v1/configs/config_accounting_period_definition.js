const express = require("express");
const mongo = require("mongoose");
const moment = require('moment');
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const { bulkUploader } = require('../helper/file_uploader');
const AccountingCalenderModel = require('../../../models/configAccountingCalenderModel');
const AccountingPeriodDefinitionModel = require('../../../models/configAccountingPeriodDefinitionModel');
const AccountingPeriodDefinitionAuditModel = require('../../../models/configAccountingPeriodDefinitionAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const accountingPeriodDefinitionMiddleware = require('../../../middleware/config_accounting_period_definition_middleware');

/**
 * @swagger
 * /api/v1/config/accounting-period-definition/add:
 *  post:
 *      summary: Add Accounting Period Definition
 *      tags: [Config-Accounting Period Definition]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          apId:
 *                              type: integer
 *                              default: 1
 *                          apName:
 *                              type: string
 *                              default: 2020-P1-JAN
 *                          accountingCalender:
 *                              type: string
 *                              default: 62abf3e623bf17b6ca8dffa3
 *                          periodType:
 *                              type: string
 *                              default: Operating
 *                          apStartDate:
 *                              type: string
 *                              default: 2020-12-01
 *                          apEndDate:
 *                              type: string
 *                              default: 2020-12-01
 *                          priorMonthClosingDate:
 *                              type: string
 *                              default: 2009-12-01
 *                          accountingQuarter:
 *                              type: string
 *                              default: 2020-Q1
 *                          accountingYear:
 *                              type: string
 *                              default: FY 2020
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, accountingPeriodDefinitionMiddleware.canCreate, (req, res) => {
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
 * /api/v1/config/accounting-period-definition/add/bulk:
 *  post:
 *      summary: Add Bulk Accounting Period Definition using csv file
 *      tags: [Config-Accounting Period Definition]
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
router.post("/add/bulk", authUser, accountingPeriodDefinitionMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Accounting Period Definition', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        apId: 'required|numeric',
        apName: 'required|string',
        accountingCalender: 'required|string',
        periodType: 'required|string',
        apStartDate: 'required|string',
        apEndDate: 'required|string',
        priorMonthClosingDate: 'required|string',
        accountingQuarter: 'required|string',
        accountingYear: 'required|string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    apId: parseInt(inputData.apId),
                    apName: inputData.apName.toString().trim(),
                    accountingCalender: inputData.accountingCalender.toString().trim(),
                    periodType: inputData.periodType.toString().trim(),
                    apStartDate: moment(inputData.apStartDate),
                    apEndDate: moment(inputData.apEndDate),
                    priorMonthClosingDate: moment(inputData.priorMonthClosingDate),
                    accountingQuarter: inputData.accountingQuarter.toString().trim(),
                    accountingYear: inputData.accountingYear.toString().trim(),
                };

                if (!helper.isValidObjectId(data.accountingCalender)) {
                    return callback(counter, false, 'accountingCalender is not a valid Accounting Calender Id!');
                } else {
                    const itemDetails = await AccountingCalenderModel
                        .find({_id: data.accountingCalender, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Accounting Calender Id for accountingCalender => ' + data.party + '!');
                    }
                }

                if(!helper.isObjectContainsKey(helper.sysConst.periodTypes, data.periodType)){
                    return callback(counter, false, 'periodType is not valid!');
                }

                if(!data.apStartDate.isValid()){
                    return callback(counter, false, 'apStartDate is not a valid date!');
                }else{
                    data.apStartDate = new Date(data.apStartDate.format());
                }

                if(!data.apEndDate.isValid()){
                    return callback(counter, false, 'apEndDate is not a valid date!');
                }else{
                    data.apEndDate = new Date(data.apEndDate.format());
                }

                if(!data.priorMonthClosingDate.isValid()){
                    return callback(counter, false, 'priorMonthClosingDate is not a valid date!');
                }else{
                    data.priorMonthClosingDate = new Date(data.priorMonthClosingDate.format());
                }

                const configFind = await AccountingPeriodDefinitionModel.find({
                    apId: data.apId,
                    apName: data.apName,
                    accountingCalender: data.accountingCalender,
                });

                if (configFind.length > 0) {
                    return callback(counter, false, 'Accounting Period Definition is already '
                        + 'present with apId => `'
                        + configFind[0].apId
                        + '` and apName => `'
                        + configFind[0].apName
                        + '` and accountingCalender => `'
                        + configFind[0].accountingCalender + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new AccountingPeriodDefinitionModel({
                    apId: data.apId,
                    apName: data.apName,
                    accountingCalender: data.accountingCalender,
                    periodType: data.periodType,
                    apStartDate: data.apStartDate,
                    apEndDate: data.apEndDate,
                    priorMonthClosingDate: data.priorMonthClosingDate,
                    accountingQuarter: data.accountingQuarter,
                    accountingYear: data.accountingYear,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new AccountingPeriodDefinitionAuditModel({
                    apId: ib.apId,
                    apName: ib.apName,
                    accountingCalender: ib.accountingCalender,
                    periodType: ib.periodType,
                    apStartDate: ib.apStartDate,
                    apEndDate: ib.apEndDate,
                    priorMonthClosingDate: ib.priorMonthClosingDate,
                    accountingQuarter: ib.accountingQuarter,
                    accountingYear: ib.accountingYear,
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

                callback(counter, true, 'Accounting Period Definition added successfully!', ib);

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
 * /api/v1/config/accounting-period-definition/update/{id}:
 *  put:
 *      summary: Update Accounting Period Definition by id
 *      tags: [Config-Accounting Period Definition]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Accounting Period Definition Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          acId:
 *                              type: string
 *                              default: US SEC Fiscal Year
 *                          acName:
 *                              type: string
 *                              default: US SEC Fiscal Year
 *                          accountingYearType:
 *                              type: string
 *                              default: Fiscal
 *                          accountingYearEndDate:
 *                              type: string
 *                              default: 2026-12-01
 *                          periodUnits:
 *                              type: string
 *                              default: Month
 *                              enum: [Month, Year, Day]
 *                          calenderStartDate:
 *                              type: string
 *                              default: 2020-12-01
 *                          calenderEndDate:
 *                              type: string
 *                              default: 2040-12-01
 *                          calenderActiveStatus:
 *                              type: boolean
 *                              default: true
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, accountingPeriodDefinitionMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        apId: 'numeric',
        apName: 'string',
        accountingCalender: 'string',
        periodType: 'string',
        apStartDate: 'string',
        apEndDate: 'string',
        priorMonthClosingDate: 'string',
        accountingQuarter: 'string',
        accountingYear: 'string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await AccountingPeriodDefinitionModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Accounting Period Definition with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.apId !== undefined) {
                    data.apId = parseInt(req.body.apId);
                }

                if (req.body.acName !== undefined) {
                    data.acName = req.body.acName.toString().trim();
                }

                if (req.body.accountingCalender !== undefined) {
                    data.accountingCalender = req.body.accountingCalender.toString().trim();

                    if (!helper.isValidObjectId(data.accountingCalender)) {
                        return br.sendNotSuccessful(res, 'accountingCalender is not a valid Accounting Calender Id!');
                    } else {
                        const itemDetails = await AccountingCalenderModel
                            .find({_id: data.accountingCalender, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Ib Accounting Calender for accountingCalender => ' + data.accountingCalender + '!');
                        }
                    }
                }

                if (req.body.periodType !== undefined) {
                    data.periodType = req.body.periodType.toString().trim();

                    if(!helper.isObjectContainsKey(helper.sysConst.periodTypes, data.periodType)){
                        return br.sendNotSuccessful(res,'periodType is not valid!');
                    }
                }

                if (req.body.apStartDate !== undefined) {
                    data.apStartDate = moment(req.body.apStartDate);

                    if(!data.apStartDate.isValid()){
                        return br.sendNotSuccessful(res, 'apStartDate is not a valid date!');
                    }else{
                        data.apStartDate = new Date(data.apStartDate.format());
                    }
                }

                if (req.body.apEndDate !== undefined) {
                    data.apEndDate = moment(req.body.apEndDate);

                    if(!data.apEndDate.isValid()){
                        return br.sendNotSuccessful(res, 'apEndDate is not a valid date!');
                    }else{
                        data.apEndDate = new Date(data.apEndDate.format());
                    }
                }

                if (req.body.priorMonthClosingDate !== undefined) {
                    data.priorMonthClosingDate = moment(req.body.priorMonthClosingDate);

                    if(!data.priorMonthClosingDate.isValid()){
                        return br.sendNotSuccessful(res, 'priorMonthClosingDate is not a valid date!');
                    }else{
                        data.priorMonthClosingDate = new Date(data.priorMonthClosingDate.format());
                    }
                }

                if (req.body.accountingQuarter !== undefined) {
                    data.accountingQuarter = req.body.accountingQuarter.toString().trim();
                }

                if (req.body.accountingYear !== undefined) {
                    data.accountingYear = req.body.accountingYear.toString().trim();
                }

                let configFind = await AccountingPeriodDefinitionModel.find({
                    _id: {
                        $nin: id
                    },
                    apId: data.apId !== undefined
                        ? data.apId
                        : configItem.apId,
                    apName: data.apName !== undefined
                        ? data.apName
                        : configItem.apName,
                    accountingCalender: data.accountingCalender !== undefined
                        ? data.accountingCalender
                        : configItem.accountingCalender
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Accounting Period Definition is already '
                        + 'present with apId => `'
                        + configFind[0].apId
                        + '` and apName => `'
                        + configFind[0].apName
                        + '` and accountingCalender => `'
                        + configFind[0].accountingCalender + ' !',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await AccountingPeriodDefinitionModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await AccountingPeriodDefinitionModel.find({
                    _id: id,
                    isDeleted: false
                }).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new AccountingPeriodDefinitionAuditModel({
                    apId: configItemDetails.apId,
                    apName: configItemDetails.apName,
                    accountingCalender: configItemDetails.accountingCalender,
                    periodType: configItemDetails.periodType,
                    apStartDate: configItemDetails.apStartDate,
                    apEndDate: configItemDetails.apEndDate,
                    priorMonthClosingDate: configItemDetails.priorMonthClosingDate,
                    accountingQuarter: configItemDetails.accountingQuarter,
                    accountingYear: configItemDetails.accountingYear,
                    changedByUser: configItemDetails.changedByUser,
                    changedDate: configItemDetails.changedDate,
                    createdByUser: configItemDetails.createdByUser,
                    isDeleted: configItemDetails.isDeleted,
                    deletedBy: configItemDetails.deletedBy,
                    deleteReason: configItemDetails.deleteReason,
                    actionItemId: configItemDetails._id,
                    action: helper.sysConst.permissionAccessTypes.EDIT,
                    actionDate: new Date(),
                    actionBy: configItemDetails.createdByUser,
                }, {session: session});
                await auditData.save();

                await session.commitTransaction();

                br.sendSuccess(res, configItemDetails, 'Accounting Period Definition updated successfully!');

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
 * /api/v1/config/accounting-period-definition/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Accounting Period Definition]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, accountingPeriodDefinitionMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'apId',
                'apName',
                'accountingCalender',
                'periodType',
                'apStartDate',
                'apEndDate',
                'priorMonthClosingDate',
                'accountingQuarter',
                'accountingYear',
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configAccountingPeriodDefinitionInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/accounting-period-definition/get-all:
 *  get:
 *      summary: Get all Accounting Period Definition
 *      tags: [Config-Accounting Period Definition]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Accounting Period Definition using apName
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, accountingPeriodDefinitionMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.apName = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await AccountingPeriodDefinitionModel.find(filter).populate('accountingCalender');
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/accounting-period-definition/get/{id}:
 *  get:
 *      summary: get Accounting Period Definition details by id
 *      tags: [Config-Accounting Period Definition]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Accounting Period Definition Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, accountingPeriodDefinitionMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await AccountingPeriodDefinitionModel.find({
            _id: id,
            isDeleted: false
        }).populate('accountingCalender');

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Accounting Period Definition with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/accounting-period-definition/delete/{id}:
 *  delete:
 *      summary: delete Accounting Period Definition details by id
 *      tags: [Config-Accounting Period Definition]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Accounting Period Definition Id
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
router.delete("/delete/:id", authUser, accountingPeriodDefinitionMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await AccountingPeriodDefinitionModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Accounting Period Definition with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await AccountingPeriodDefinitionModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await AccountingPeriodDefinitionModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new AccountingPeriodDefinitionAuditModel({
            apId: configItemDetails.apId,
            apName: configItemDetails.apName,
            accountingCalender: configItemDetails.accountingCalender,
            periodType: configItemDetails.periodType,
            apStartDate: configItemDetails.apStartDate,
            apEndDate: configItemDetails.apEndDate,
            priorMonthClosingDate: configItemDetails.priorMonthClosingDate,
            accountingQuarter: configItemDetails.accountingQuarter,
            accountingYear: configItemDetails.accountingYear,
            changedByUser: configItemDetails.changedByUser,
            changedDate: configItemDetails.changedDate,
            createdByUser: configItemDetails.createdByUser,
            isDeleted: configItemDetails.isDeleted,
            deletedBy: configItemDetails.deletedBy,
            deleteReason: configItemDetails.deleteReason,
            actionItemId: configItemDetails._id,
            action: helper.sysConst.permissionAccessTypes.DELETE,
            actionDate: new Date(),
            actionBy: configItemDetails.createdByUser,
        }, {session: session});
        await auditData.save();

        await session.commitTransaction();

        br.sendSuccess(res, configItemDetails, 'Accounting Period Definition deleted successfully!');
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
