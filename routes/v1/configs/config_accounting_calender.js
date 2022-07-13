const express = require("express");
const mongo = require("mongoose");
const moment = require('moment');
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const uploader = require('../helper/file_uploader');
const AccountingCalenderModel = require('../../../models/configAccountingCalenderModel');
const AccountingCalenderAuditModel = require('../../../models/configAccountingCalenderAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const accountingCalenderMiddleware = require('../../../middleware/config_accounting_calender_middleware');

/**
 * @swagger
 * /api/v1/config/accounting-calender/add:
 *  post:
 *      summary: Add Accounting Calender
 *      tags: [Config-Accounting Calender]
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
router.post("/add", authUser, accountingCalenderMiddleware.canCreate, (req, res) => {
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
 * /api/v1/config/accounting-calender/add/bulk:
 *  post:
 *      summary: Add Bulk Accounting Calender using csv file
 *      tags: [Config-Accounting Calender]
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
router.post("/add/bulk", authUser, accountingCalenderMiddleware.canCreate, uploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Accounting Calender', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        acId: 'required|string',
        acName: 'required|string',
        accountingYearType: 'required|string',
        accountingYearEndDate: 'required|string',
        periodUnits: 'required|string',
        calenderStartDate: 'required|string',
        calenderEndDate: 'required|string',
        calenderActiveStatus: 'required|boolean',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    acId: inputData.acId.toString().trim(),
                    acName: inputData.acName.toString().trim(),
                    accountingYearType: inputData.accountingYearType.toString().trim(),
                    accountingYearEndDate: moment(inputData.accountingYearEndDate),
                    periodUnits: inputData.periodUnits.toString().trim(),
                    calenderStartDate: moment(inputData.calenderStartDate),
                    calenderEndDate: moment(inputData.calenderEndDate),
                    calenderActiveStatus: helper.getBoolean(inputData.calenderActiveStatus),
                };

                if(!data.accountingYearEndDate.isValid()){
                    return callback(counter, false, 'accountingYearEndDate is not a valid date!');
                }else{
                    data.accountingYearEndDate = new Date(data.accountingYearEndDate.format());
                }

                if(!helper.isObjectContainsKey(helper.sysConst.acPeriodUnit, data.periodUnits)){
                    return callback(counter, false, 'periodUnits is not valid!');
                }

                if(!data.calenderStartDate.isValid()){
                    return callback(counter, false, 'calenderStartDate is not a valid date!');
                }else{
                    data.calenderStartDate = new Date(data.calenderStartDate.format());
                }

                if(!data.calenderEndDate.isValid()){
                    return callback(counter, false, 'calenderEndDate is not a valid date!');
                }else{
                    data.calenderEndDate = new Date(data.calenderEndDate.format());
                }

                const configFind = await AccountingCalenderModel.find({
                    acId: data.acId,
                    acName: data.acName,
                });

                if (configFind.length > 0) {
                    return callback(counter, false, 'Accounting Calender is already '
                        + 'present with acId => `'
                        + configFind[0].acId
                        + '` and acName => `'
                        + configFind[0].acName + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new AccountingCalenderModel({
                    acId: data.acId,
                    acName: data.acName,
                    accountingYearType: data.accountingYearType,
                    accountingYearEndDate: data.accountingYearEndDate,
                    periodUnits: data.periodUnits,
                    calenderStartDate: data.calenderStartDate,
                    calenderEndDate: data.calenderEndDate,
                    calenderActiveStatus: data.calenderActiveStatus,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new AccountingCalenderAuditModel({
                    acId: ib.acId,
                    acName: ib.acName,
                    accountingYearType: ib.accountingYearType,
                    accountingYearEndDate: ib.accountingYearEndDate,
                    periodUnits: ib.periodUnits,
                    calenderStartDate: ib.calenderStartDate,
                    calenderEndDate: ib.calenderEndDate,
                    calenderActiveStatus: ib.calenderActiveStatus,
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

                callback(counter, true, 'Accounting Calender added successfully!', ib);

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
 * /api/v1/config/accounting-calender/update/{id}:
 *  put:
 *      summary: Update Accounting Calender by id
 *      tags: [Config-Accounting Calender]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Accounting Calender Id
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
router.put("/update/:id", authUser, accountingCalenderMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        acId: 'string',
        acName: 'string',
        accountingYearType: 'string',
        accountingYearEndDate: 'string',
        periodUnits: 'string',
        calenderStartDate: 'string',
        calenderEndDate: 'string',
        calenderActiveStatus: 'boolean',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await AccountingCalenderModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Accounting Calender with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.acId !== undefined) {
                    data.acId = req.body.acId.toString().trim();
                }

                if (req.body.acName !== undefined) {
                    data.acName = req.body.acName.toString().trim();
                }

                if (req.body.accountingYearType !== undefined) {
                    data.accountingYearType = req.body.accountingYearType.toString().trim();
                }

                if (req.body.accountingYearEndDate !== undefined) {
                    data.accountingYearEndDate = moment(req.body.accountingYearEndDate);

                    if(!data.accountingYearEndDate.isValid()){
                        return br.sendNotSuccessful(res, 'accountingYearEndDate is not a valid date!');
                    }else{
                        data.accountingYearEndDate = new Date(data.accountingYearEndDate.format());
                    }
                }

                if (req.body.periodUnits !== undefined) {
                    data.periodUnits = req.body.periodUnits.toString().trim();

                    if(!helper.isObjectContainsKey(helper.sysConst.acPeriodUnit, data.periodUnits)){
                        return br.sendNotSuccessful(res,'periodUnits is not valid!');
                    }
                }

                if (req.body.calenderStartDate !== undefined) {
                    data.calenderStartDate = moment(req.body.calenderStartDate);

                    if(!data.calenderStartDate.isValid()){
                        return br.sendNotSuccessful(res, 'calenderStartDate is not a valid date!');
                    }else{
                        data.calenderStartDate = new Date(data.calenderStartDate.format());
                    }
                }

                if (req.body.calenderEndDate !== undefined) {
                    data.calenderEndDate = moment(req.body.calenderEndDate);

                    if(!data.calenderEndDate.isValid()){
                        return br.sendNotSuccessful(res, 'calenderEndDate is not a valid date!');
                    }else{
                        data.calenderEndDate = new Date(data.calenderEndDate.format());
                    }
                }

                if (req.body.calenderActiveStatus !== undefined) {
                    data.calenderActiveStatus = helper.getBoolean(req.body.calenderActiveStatus);
                }

                let configFind = await AccountingCalenderModel.find({
                    _id: {
                        $nin: id
                    },
                    id: data.id !== undefined
                        ? data.id
                        : configItem.securityId,
                    name: data.name !== undefined
                        ? data.name
                        : configItem.name,
                    holidayCalender: data.holidayCalender !== undefined
                        ? data.holidayCalender
                        : configItem.holidayCalender
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Accounting Calender is already '
                        + 'present with acId => `'
                        + configFind[0].acId
                        + '` and acName => `'
                        + configFind[0].acName + ' !',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await AccountingCalenderModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await AccountingCalenderModel.find({
                    _id: id,
                    isDeleted: false
                }).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new AccountingCalenderAuditModel({
                    acId: configItemDetails.acId,
                    acName: configItemDetails.acName,
                    accountingYearType: configItemDetails.accountingYearType,
                    accountingYearEndDate: configItemDetails.accountingYearEndDate,
                    periodUnits: configItemDetails.periodUnits,
                    calenderStartDate: configItemDetails.calenderStartDate,
                    calenderEndDate: configItemDetails.calenderEndDate,
                    calenderActiveStatus: configItemDetails.calenderActiveStatus,
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

                br.sendSuccess(res, configItemDetails, 'Accounting Calender updated successfully!');

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
 * /api/v1/config/accounting-calender/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Accounting Calender]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, accountingCalenderMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'acId',
                'acName',
                'accountingYearType',
                'accountingYearEndDate',
                'periodUnits',
                'calenderStartDate',
                'calenderEndDate',
                'calenderActiveStatus',
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configAccountingCalenderInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/accounting-calender/get-all:
 *  get:
 *      summary: Get all Accounting Calender
 *      tags: [Config-Accounting Calender]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Accounting Calender using acName
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, accountingCalenderMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.acName = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await AccountingCalenderModel.find(filter);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/accounting-calender/get/{id}:
 *  get:
 *      summary: get Accounting Calender details by id
 *      tags: [Config-Accounting Calender]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Accounting Calender Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, accountingCalenderMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await AccountingCalenderModel.find({
            _id: id,
            isDeleted: false
        });

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Accounting Calender with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/accounting-calender/delete/{id}:
 *  delete:
 *      summary: delete Accounting Calender details by id
 *      tags: [Config-Accounting Calender]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Accounting Calender Id
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
router.delete("/delete/:id", authUser, accountingCalenderMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await AccountingCalenderModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Accounting Calender with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await AccountingCalenderModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await AccountingCalenderModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new AccountingCalenderAuditModel({
            acId: configItemDetails.acId,
            acName: configItemDetails.acName,
            accountingYearType: configItemDetails.accountingYearType,
            accountingYearEndDate: configItemDetails.accountingYearEndDate,
            periodUnits: configItemDetails.periodUnits,
            calenderStartDate: configItemDetails.calenderStartDate,
            calenderEndDate: configItemDetails.calenderEndDate,
            calenderActiveStatus: configItemDetails.calenderActiveStatus,
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

        br.sendSuccess(res, configItemDetails, 'Accounting Calender deleted successfully!');
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
