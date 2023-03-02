const express = require("express");
const mongo = require("mongoose");
const moment = require('moment');
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const { bulkUploader } = require('../helper/file_uploader');
const IbAssetModel = require('../../../models/configIbAssetClassModel');
const TransactionCodeModel = require('../../../models/configTransactionCodeModel');
const TransactionCodeAuditModel = require('../../../models/configTransactionCodeAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const transactionCodeMiddleware = require('../../../middleware/config_transaction_code_middleware');

/**
 * @swagger
 * /api/v1/config/transaction-code/add:
 *  post:
 *      summary: Add Transaction Code
 *      tags: [Config-Transaction Code]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          id:
 *                              type: string
 *                              default: Bond Additional Issuances
 *                          businessEvent:
 *                              type: string
 *                              default: Additional Issuance
 *                          lifeCyclePeriodType:
 *                              type: string
 *                              default: Opening
 *                          windowName:
 *                              type: string
 *                              default: Security
 *                          instrumentType:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          transactionLevel:
 *                              type: string
 *                              default: Holding
 *                          transactionCode:
 *                              type: string
 *                              default: Buy
 *                          secondaryTransactionCode:
 *                              type: string
 *                              default: Buy
 *                          rvOrCanTransactionCode:
 *                              type: string
 *                              default: R-Buy
 *                          secondaryRvOrCanTransactionCode:
 *                              type: string
 *                              default: R-Buy
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, transactionCodeMiddleware.canCreate, (req, res) => {
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
 * /api/v1/config/transaction-code/add/bulk:
 *  post:
 *      summary: Add Bulk Transaction Code using csv file
 *      tags: [Config-Transaction Code]
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
router.post("/add/bulk", authUser, transactionCodeMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Transaction Code', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        id: 'required|string',
        businessEvent: 'required|string',
        lifeCyclePeriodType: 'required|string',
        windowName: 'required|string',
        instrumentType: 'required|string',
        transactionLevel: 'required|string',
        transactionCode: 'required|string',
        secondaryTransactionCode: 'required|string',
        rvOrCanTransactionCode: 'required|string',
        secondaryRvOrCanTransactionCode: 'required|string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    id: inputData.id.toString().trim(),
                    businessEvent: inputData.businessEvent.toString().trim(),
                    lifeCyclePeriodType: inputData.lifeCyclePeriodType.toString().trim(),
                    windowName: inputData.windowName.toString().trim(),
                    instrumentType: inputData.instrumentType.toString().trim(),
                    transactionLevel: inputData.transactionLevel.toString().trim(),
                    transactionCode: inputData.transactionCode.toString().trim(),
                    secondaryTransactionCode: inputData.secondaryTransactionCode.toString().trim(),
                    rvOrCanTransactionCode: inputData.rvOrCanTransactionCode.toString().trim(),
                    secondaryRvOrCanTransactionCode: inputData.secondaryRvOrCanTransactionCode.toString().trim(),
                };

                if (!helper.isValidObjectId(data.instrumentType)) {
                    return callback(counter, false, 'instrumentType is not a valid Ib Asset Id!');
                } else {
                    const itemDetails = await IbAssetModel
                        .find({_id: data.instrumentType, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Ib Asset Id for instrumentType => ' + data.instrumentType + '!');
                    }
                }

                if(!helper.isObjectContainsKey(helper.sysConst.transactionCodeTransactionLevels, data.transactionLevel)){
                    return callback(counter, false, 'transactionLevel is not valid!');
                }

                const configFind = await TransactionCodeModel.find({
                    id: data.id,
                    businessEvent: data.businessEvent,
                });

                if (configFind.length > 0) {
                    return callback(counter, false, 'Transaction Code is already '
                        + 'present with id => `'
                        + configFind[0].id
                        + '` and businessEvent => `'
                        + configFind[0].businessEvent + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new TransactionCodeModel({
                    id: data.id,
                    businessEvent: data.businessEvent,
                    lifeCyclePeriodType: data.lifeCyclePeriodType,
                    windowName: data.windowName,
                    instrumentType: data.instrumentType,
                    transactionLevel: data.transactionLevel,
                    transactionCode: data.transactionCode,
                    secondaryTransactionCode: data.secondaryTransactionCode,
                    rvOrCanTransactionCode: data.rvOrCanTransactionCode,
                    secondaryRvOrCanTransactionCode: data.secondaryRvOrCanTransactionCode,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new TransactionCodeAuditModel({
                    id: ib.id,
                    businessEvent: ib.businessEvent,
                    lifeCyclePeriodType: ib.lifeCyclePeriodType,
                    windowName: ib.windowName,
                    instrumentType: ib.instrumentType,
                    transactionLevel: ib.transactionLevel,
                    transactionCode: ib.transactionCode,
                    secondaryTransactionCode: ib.secondaryTransactionCode,
                    rvOrCanTransactionCode: ib.rvOrCanTransactionCode,
                    secondaryRvOrCanTransactionCode: ib.secondaryRvOrCanTransactionCode,
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

                callback(counter, true, 'Transaction Code added successfully!', ib);

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
 * /api/v1/config/transaction-code/update/{id}:
 *  put:
 *      summary: Update Transaction Code by id
 *      tags: [Config-Transaction Code]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Transaction Code Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          id:
 *                              type: string
 *                              default: Bond Additional Issuances
 *                          businessEvent:
 *                              type: string
 *                              default: Additional Issuance
 *                          lifeCyclePeriodType:
 *                              type: string
 *                              default: Opening
 *                          windowName:
 *                              type: string
 *                              default: Security
 *                          instrumentType:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          transactionLevel:
 *                              type: string
 *                              default: Holding
 *                          transactionCode:
 *                              type: string
 *                              default: Buy
 *                          secondaryTransactionCode:
 *                              type: string
 *                              default: Buy
 *                          rvOrCanTransactionCode:
 *                              type: string
 *                              default: R-Buy
 *                          secondaryRvOrCanTransactionCode:
 *                              type: string
 *                              default: R-Buy
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, transactionCodeMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        id: 'string',
        businessEvent: 'string',
        lifeCyclePeriodType: 'string',
        windowName: 'string',
        instrumentType: 'string',
        transactionLevel: 'string',
        transactionCode: 'string',
        secondaryTransactionCode: 'string',
        rvOrCanTransactionCode: 'string',
        secondaryRvOrCanTransactionCode: 'string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await TransactionCodeModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Transaction Code with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.id !== undefined) {
                    data.id = req.body.id.toString().trim();
                }

                if (req.body.businessEvent !== undefined) {
                    data.businessEvent = req.body.businessEvent.toString().trim();
                }

                if (req.body.lifeCyclePeriodType !== undefined) {
                    data.lifeCyclePeriodType = req.body.lifeCyclePeriodType.toString().trim();

                    if(!helper.isObjectContainsKey(helper.sysConst.transactionCodeLifeCyclePeriodTypes, data.lifeCyclePeriodType)){
                        return br.sendNotSuccessful(res,'lifeCyclePeriodType is not valid!');
                    }
                }

                if (req.body.windowName !== undefined) {
                    data.windowName = req.body.windowName.toString().trim();
                }

                if (req.body.instrumentType !== undefined) {
                    data.instrumentType = req.body.instrumentType.toString().trim();

                    if (!helper.isValidObjectId(data.instrumentType)) {
                        return br.sendNotSuccessful(res, 'instrumentType is not a valid Ib Asset Id!');
                    } else {
                        const itemDetails = await IbAssetModel
                            .find({_id: data.instrumentType, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Ib Asset Id for instrumentType => ' + data.instrumentType + '!');
                        }
                    }
                }

                if (req.body.transactionLevel !== undefined) {
                    data.transactionLevel = req.body.transactionLevel.toString().trim();

                    if(!helper.isObjectContainsKey(helper.sysConst.transactionCodeTransactionLevels, data.transactionLevel)){
                        return br.sendNotSuccessful(res,'transactionLevel is not valid!');
                    }
                }

                if (req.body.transactionCode !== undefined) {
                    data.transactionCode = req.body.transactionCode.toString().trim();
                }

                if (req.body.secondaryTransactionCode !== undefined) {
                    data.secondaryTransactionCode = req.body.secondaryTransactionCode.toString().trim();
                }

                if (req.body.rvOrCanTransactionCode !== undefined) {
                    data.rvOrCanTransactionCode = req.body.rvOrCanTransactionCode.toString().trim();
                }

                if (req.body.secondaryRvOrCanTransactionCode !== undefined) {
                    data.secondaryRvOrCanTransactionCode = req.body.secondaryRvOrCanTransactionCode.toString().trim();
                }

                let configFind = await TransactionCodeModel.find({
                    _id: {
                        $nin: id
                    },
                    id: data.id !== undefined
                        ? data.id
                        : configItem.securityId,
                    businessEvent: data.businessEvent !== undefined
                        ? data.businessEvent
                        : configItem.businessEvent
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Transaction Code is already '
                        + 'present with id => `'
                        + configFind[0].id
                        + '` and businessEvent => `'
                        + configFind[0].businessEvent + ' !',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await TransactionCodeModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await TransactionCodeModel.find({
                    _id: id,
                    isDeleted: false
                }).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new TransactionCodeAuditModel({
                    id: configItemDetails.id,
                    businessEvent: configItemDetails.businessEvent,
                    lifeCyclePeriodType: configItemDetails.lifeCyclePeriodType,
                    windowName: configItemDetails.windowName,
                    instrumentType: configItemDetails.instrumentType,
                    transactionLevel: configItemDetails.transactionLevel,
                    transactionCode: configItemDetails.transactionCode,
                    secondaryTransactionCode: configItemDetails.secondaryTransactionCode,
                    rvOrCanTransactionCode: configItemDetails.rvOrCanTransactionCode,
                    secondaryRvOrCanTransactionCode: configItemDetails.secondaryRvOrCanTransactionCode,
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

                br.sendSuccess(res, configItemDetails, 'Transaction Code updated successfully!');

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
 * /api/v1/config/transaction-code/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Transaction Code]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, transactionCodeMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'id',
                'businessEvent',
                'lifeCyclePeriodType',
                'windowName',
                'instrumentType',
                'transactionLevel',
                'transactionCode',
                'secondaryTransactionCode',
                'rvOrCanTransactionCode',
                'secondaryRvOrCanTransactionCode',
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configTransactionCodeInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/transaction-code/get-all:
 *  get:
 *      summary: Get all Transaction Code
 *      tags: [Config-Transaction Code]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Transaction Code using transactionCodeMiddleware
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, transactionCodeMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.businessEvent = {
                $regex: new RegExp('^' + req.query.search, 'i'),
            }
        }

        let assets = await TransactionCodeModel.find(filter).populate('instrumentType');
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/transaction-code/get/{id}:
 *  get:
 *      summary: get Transaction Code details by id
 *      tags: [Config-Transaction Code]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Transaction Code Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, transactionCodeMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await TransactionCodeModel.find({
            _id: id,
            isDeleted: false
        }).populate('instrumentType');

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Transaction Code with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/transaction-code/delete/{id}:
 *  delete:
 *      summary: delete Transaction Code details by id
 *      tags: [Config-Transaction Code]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Transaction Code Id
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
router.delete("/delete/:id", authUser, transactionCodeMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await TransactionCodeModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Transaction Code with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await TransactionCodeModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await TransactionCodeModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new TransactionCodeAuditModel({
            id: configItemDetails.id,
            businessEvent: configItemDetails.businessEvent,
            lifeCyclePeriodType: configItemDetails.lifeCyclePeriodType,
            windowName: configItemDetails.windowName,
            instrumentType: configItemDetails.instrumentType,
            transactionLevel: configItemDetails.transactionLevel,
            transactionCode: configItemDetails.transactionCode,
            secondaryTransactionCode: configItemDetails.secondaryTransactionCode,
            rvOrCanTransactionCode: configItemDetails.rvOrCanTransactionCode,
            secondaryRvOrCanTransactionCode: configItemDetails.secondaryRvOrCanTransactionCode,
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

        br.sendSuccess(res, configItemDetails, 'Transaction Code deleted successfully!');
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
