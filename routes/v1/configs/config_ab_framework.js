const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const moment = require('moment');
const br = helper.baseResponse;
const router = new express.Router();
const { bulkUploader } = require('../helper/file_uploader');
const IbTransactionStatusModel = require('../../../models/configIbTransactionStatusModel');
const AbFrameworkModel = require('../../../models/configAbFrameworkModel');
const AbFrameworkAuditModel = require('../../../models/configAbFrameworkAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const abFrameworkMiddleware = require('../../../middleware/config_ab_framework_middleware');

/**
 * @swagger
 * /api/v1/config/ab-framework/add:
 *  post:
 *      summary: Add Ab Framework
 *      tags: [Config-Ab Framework]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          accountingFramework:
 *                              type: string
 *                              default: US GAAP
 *                          fromDate:
 *                              type: string
 *                              default: 1999-01-22
 *                          conversionDate:
 *                              type: string
 *                              default: 2019-01-22
 *                          fromBookingLevel:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          hierarchy:
 *                              type: string
 *                              default: none
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, abFrameworkMiddleware.canCreate, (req, res) => {
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
 * /api/v1/config/ab-framework/add/bulk:
 *  post:
 *      summary: Add Bulk Ab Framework using csv file
 *      tags: [Config-Ab Framework]
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
router.post("/add/bulk", authUser, abFrameworkMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Ab Framework', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        accountingFramework: 'required|string|maxLength:20',
        fromDate: 'required|string',
        conversionDate: 'required|string',
        fromBookingLevel: 'required|string',
        hierarchy: 'required|string'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    accountingFramework: inputData.accountingFramework.toString().trim(),
                    fromDate: moment(inputData.fromDate),
                    conversionDate: moment(inputData.conversionDate),
                    fromBookingLevel: inputData.fromBookingLevel,
                    hierarchy: inputData.hierarchy.toString().trim(),
                };

                if (!helper.isValidObjectId(data.fromBookingLevel)) {
                    return callback(counter, false, 'From Booking Level is not a valid Transaction Status Id!');
                }

                if (data.fromDate.isValid()) {
                    data.fromDate = new Date(data.fromDate.format());
                } else {
                    return callback(counter, false, 'Invalid fromDate!');
                }

                if (data.conversionDate.isValid()) {
                    data.conversionDate = new Date(data.conversionDate.format());
                } else {
                    return callback(counter, false, 'Invalid conversionDate!');
                }

                if (data.fromBookingLevel !== undefined) {

                    const transactionStatusDetails = await IbTransactionStatusModel
                        .find({_id: data.fromBookingLevel, isDeleted: false,});

                    if (transactionStatusDetails.length === 0) {
                        return callback(counter, false, 'Invalid Transaction Status Id for fromBookingLevel => ' + data.fromBookingLevel + '!');
                    }
                }

                const configFind = await AbFrameworkModel.find({
                    accountingFramework: data.accountingFramework,
                    fromDate: data.fromDate,
                    conversionDate: data.conversionDate,
                    fromBookingLevel: data.fromBookingLevel,
                    hierarchy: data.hierarchy,
                });

                if (configFind.length > 0) {
                    return callback(counter, false, 'Ab Framework is already '
                        + 'present with Accounting Framework => `'
                        + configFind[0].accountingFramework
                        + '` and From Date => `'
                        + configFind[0].fromDate != null ? configFind[0].fromDate.toString() : 'null'
                        + '` and Conversion Date => `'
                        + configFind[0].conversionDate != null ? configFind[0].conversionDate.toString() : 'null'
                        + '` and From Booking Level => `'
                        + configFind[0].fromBookingLevel
                        + '` and Hierarchy => `'
                        + configFind[0].hierarchy + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new AbFrameworkModel({
                    accountingFramework: data.accountingFramework,
                    fromDate: data.fromDate,
                    conversionDate: data.conversionDate,
                    fromBookingLevel: data.fromBookingLevel,
                    hierarchy: data.hierarchy,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new AbFrameworkAuditModel({
                    accountingFramework: ib.accountingFramework,
                    fromDate: ib.fromDate,
                    conversionDate: ib.conversionDate,
                    fromBookingLevel: ib.fromBookingLevel,
                    hierarchy: ib.hierarchy,
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

                callback(counter, true, 'Ab Framework added successfully!', ib);

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
 * /api/v1/config/ab-framework/update/{id}:
 *  put:
 *      summary: Update Ab Framework by id
 *      tags: [Config-Ab Framework]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ab Framework Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          accountingFramework:
 *                              type: string
 *                              default: US GAAP
 *                          fromDate:
 *                              type: string
 *                              default: 1999-01-22
 *                          conversionDate:
 *                              type: string
 *                              default: 2019-01-22
 *                          fromBookingLevel:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          hierarchy:
 *                              type: string
 *                              default: none
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, abFrameworkMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        costBasisProfileId: 'string|maxLength:30',
        costBasisProfileName: 'string|maxLength:30',
        cbaRuleId: 'string|maxLength:30',
        cbaRuleName: 'string|maxLength:30',
        cbaRuleType: 'string|maxLength:30'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await AbFrameworkModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Ab Framework with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.accountingFramework !== undefined) {
                    data.accountingFramework = req.body.accountingFramework.toString().trim();
                }

                if (req.body.fromDate !== undefined) {
                    data.fromDate = moment(req.body.fromDate);

                    if (data.fromDate.isValid()) {
                        data.fromDate = new Date(data.fromDate.format());
                    } else {
                        return br.sendNotSuccessful(res, 'Invalid fromDate!');
                    }
                }

                if (req.body.conversionDate !== undefined && moment(req.body.conversionDate).isValid()) {
                    data.conversionDate = new Date(req.body.conversionDate);
                }

                if (req.body.fromBookingLevel !== undefined) {
                    data.fromBookingLevel = req.body.fromBookingLevel.toString().trim();

                    const transactionStatusDetails = await IbTransactionStatusModel
                        .find({_id: data.fromBookingLevel, isDeleted: false,});

                    if (transactionStatusDetails.length === 0) {
                        return br.sendNotSuccessful(res, 'Invalid Transaction Status Id for fromBookingLevel => ' + data.fromBookingLevel + '!');
                    }
                }

                if (req.body.hierarchy !== undefined) {
                    data.hierarchy = req.body.hierarchy.toString().trim();
                }

                let configFind = await AbFrameworkModel.find({
                    _id: {
                        $nin: id
                    },
                    accountingFramework: data.accountingFramework !== undefined
                        ? data.accountingFramework
                        : configItem.accountingFramework,
                    fromDate: data.fromDate !== undefined
                        ? data.fromDate
                        : configItem.fromDate,
                    fromBookingLevel: data.fromBookingLevel !== undefined
                        ? data.fromBookingLevel
                        : configItem.fromBookingLevel,
                    hierarchy: data.hierarchy !== undefined
                        ? data.hierarchy
                        : configItem.hierarchy
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Ab Framework is already '
                        + 'present with Accounting Framework => `'
                        + configFind[0].accountingFramework
                        + '` and From Date => `'
                        + configFind[0].fromDate
                        + '` and From Booking Level => `'
                        + configFind[0].fromBookingLevel
                        + '` and Hierarchy => `'
                        + configFind[0].hierarchy + '!',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await AbFrameworkModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await AbFrameworkModel.find({_id: id, isDeleted: false}).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new AbFrameworkAuditModel({
                    accountingFramework: configItemDetails.accountingFramework,
                    fromDate: configItemDetails.fromDate,
                    conversionDate: configItemDetails.conversionDate,
                    fromBookingLevel: configItemDetails.fromBookingLevel,
                    hierarchy: configItemDetails.hierarchy,
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

                br.sendSuccess(res, configItemDetails, 'Ab Framework updated successfully!');

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
 * /api/v1/config/ab-framework/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Ab Framework]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, abFrameworkMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([],{
            fields: [
                'accountingFramework',
                'fromDate',
                'conversionDate',
                'fromBookingLevel',
                'hierarchy'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configAbFrameworkBulkInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ab-framework/get-all:
 *  get:
 *      summary: Get all Ab Framework
 *      tags: [Config-Ab Framework]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Cost Basis Rules using costBasisProfileName
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, abFrameworkMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.costBasisProfileName = {
                $regex: new RegExp('^' + req.query.search, 'i'),
            }
        }

        let assets = await AbFrameworkModel.find(filter);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ab-framework/get/{id}:
 *  get:
 *      summary: get Ab Framework details by id
 *      tags: [Config-Ab Framework]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ab Framework Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, abFrameworkMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await AbFrameworkModel.find({_id: id, isDeleted: false});

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Ab Framework with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ab-framework/delete/{id}:
 *  delete:
 *      summary: delete Ab Framework details by id
 *      tags: [Config-Ab Framework]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ab Framework Id
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
router.delete("/delete/:id", authUser, abFrameworkMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await AbFrameworkModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Ab Framework with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await AbFrameworkModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await AbFrameworkModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new AbFrameworkAuditModel({
            costBasisProfileId: configItemDetails.costBasisProfileId,
            costBasisProfileName: configItemDetails.costBasisProfileName,
            cbaRuleId: configItemDetails.cbaRuleId,
            cbaRuleName: configItemDetails.cbaRuleName,
            cbaRuleType: configItemDetails.cbaRuleType,
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

        br.sendSuccess(res, configItemDetails, 'Ab Framework deleted successfully!');
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
