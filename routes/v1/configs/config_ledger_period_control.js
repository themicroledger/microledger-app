const express = require("express");
const mongo = require("mongoose");
const moment = require('moment');
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const { bulkUploader } = require('../helper/file_uploader');
const LedgerLookupModel = require('../../../models/configLedgerLookupModel');
const AccountingPeriodDefinitionModel = require('../../../models/configAccountingPeriodDefinitionModel');
const LedgerPeriodControlModel = require('../../../models/configLedgerPeriodControlModel');
const LedgerPeriodControlAuditModel = require('../../../models/configLedgerPeriodControlAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const ledgerPeriodControlMiddleware = require('../../../middleware/config_ledger_period_control_middleware');

/**
 * @swagger
 * /api/v1/config/ledger-period-control/add:
 *  post:
 *      summary: Add Ledger Period Control
 *      tags: [Config-Ledger Period Control]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          ledgerId:
 *                              type: string
 *                              default: 62abf3e623bf17b6ca8dffa3
 *                          accountingPeriod:
 *                              type: string
 *                              default: 62abf3e623bf17b6ca8dffa3
 *                          periodClosedStatus:
 *                              type: string
 *                              default: Open
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, ledgerPeriodControlMiddleware.canCreate, (req, res) => {
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
 * /api/v1/config/ledger-period-control/add/bulk:
 *  post:
 *      summary: Add Bulk Ledger Period Control using csv file
 *      tags: [Config-Ledger Period Control]
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
router.post("/add/bulk", authUser, ledgerPeriodControlMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Ledger Period Control', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        ledgerId: 'required|string',
        accountingPeriod: 'required|string',
        periodClosedStatus: 'required|string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    ledgerId: inputData.ledgerId.toString().trim(),
                    accountingPeriod: inputData.accountingPeriod.toString().trim(),
                    periodClosedStatus: inputData.periodClosedStatus.toString().trim(),
                };

                if (!helper.isValidObjectId(data.ledgerId)) {
                    return callback(counter, false, 'ledgerId is not a valid Ledger Lookup Id!');
                } else {
                    const itemDetails = await LedgerLookupModel
                        .find({_id: data.ledgerId, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Ledger Lookup Id for ledgerId => ' + data.ledgerId + '!');
                    }
                }

                if (!helper.isValidObjectId(data.accountingPeriod)) {
                    return callback(counter, false, 'accountingPeriod is not a valid Accounting Period Definition Id!');
                } else {
                    const itemDetails = await AccountingPeriodDefinitionModel
                        .find({_id: data.accountingPeriod, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Accounting Period Definition Id for accountingPeriod => ' + data.accountingPeriod + '!');
                    }
                }

                if(!helper.isObjectContainsKey(helper.sysConst.ledgerPeriodStatus, data.periodClosedStatus)){
                    return callback(counter, false, 'periodClosedStatus is not valid!');
                }

                const configFind = await LedgerPeriodControlModel.find({
                    ledgerId: data.ledgerId,
                    accountingPeriod: data.accountingPeriod,
                });

                if (configFind.length > 0) {
                    return callback(counter, false, 'Ledger Period Control is already '
                        + 'present with ledgerId => `'
                        + configFind[0].ledgerId
                        + '` and accountingPeriod => `'
                        + configFind[0].accountingPeriod + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new LedgerPeriodControlModel({
                    ledgerId: data.ledgerId,
                    accountingPeriod: data.accountingPeriod,
                    periodClosedStatus: data.periodClosedStatus,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new LedgerPeriodControlAuditModel({
                    ledgerId: ib.ledgerId,
                    accountingPeriod: ib.accountingPeriod,
                    periodClosedStatus: ib.periodClosedStatus,
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

                callback(counter, true, 'Ledger Period Control added successfully!', ib);

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
 * /api/v1/config/ledger-period-control/update/{id}:
 *  put:
 *      summary: Update Ledger Period Control by id
 *      tags: [Config-Ledger Period Control]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ledger Period Control Id
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
 *                              default: 62abf3e623bf17b6ca8dffa3
 *                          accountingPeriod:
 *                              type: string
 *                              default: 62abf3e623bf17b6ca8dffa3
 *                          periodClosedStatus:
 *                              type: string
 *                              default: Open
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, ledgerPeriodControlMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        ledgerId: 'string',
        accountingPeriod: 'string',
        periodClosedStatus: 'string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await LedgerPeriodControlModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Ledger Period Control with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.ledgerId !== undefined) {
                    data.ledgerId = req.body.ledgerId.toString().trim();

                    if (!helper.isValidObjectId(data.ledgerId)) {
                        return br.sendNotSuccessful(res, 'ledgerId is not a valid Ledger Lookup Id!');
                    } else {
                        const itemDetails = await LedgerLookupModel
                            .find({_id: data.ledgerId, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Ledger Lookup for ledgerId => ' + data.ledgerId + '!');
                        }
                    }
                }

                if (req.body.accountingPeriod !== undefined) {
                    data.accountingPeriod = req.body.accountingPeriod.toString().trim();

                    if (!helper.isValidObjectId(data.accountingPeriod)) {
                        return br.sendNotSuccessful(res, 'accountingPeriod is not a valid Accounting Period Definition Id!');
                    } else {
                        const itemDetails = await AccountingPeriodDefinitionModel
                            .find({_id: data.accountingPeriod, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Accounting Period Definition for accountingPeriod => ' + data.accountingPeriod + '!');
                        }
                    }
                }

                if (req.body.periodClosedStatus !== undefined) {
                    data.periodClosedStatus = req.body.periodClosedStatus.toString().trim();

                    if(!helper.isObjectContainsKey(helper.sysConst.ledgerPeriodStatus, data.periodClosedStatus)){
                        return br.sendNotSuccessful(res,'periodClosedStatus is not valid!');
                    }
                }

                let configFind = await LedgerPeriodControlModel.find({
                    _id: {
                        $nin: id
                    },
                    ledgerId: data.ledgerId !== undefined
                        ? data.ledgerId
                        : configItem.ledgerId,
                    accountingPeriod: data.accountingPeriod !== undefined
                        ? data.accountingPeriod
                        : configItem.accountingPeriod
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Ledger Period Control is already '
                        + 'present with ledgerId => `'
                        + configFind[0].ledgerId
                        + '` and accountingPeriod => `'
                        + configFind[0].accountingPeriod + ' !',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await LedgerPeriodControlModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await LedgerPeriodControlModel.find({
                    _id: id,
                    isDeleted: false
                }).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new LedgerPeriodControlAuditModel({
                    ledgerId: configItemDetails.ledgerId,
                    accountingPeriod: configItemDetails.accountingPeriod,
                    periodClosedStatus: configItemDetails.periodClosedStatus,
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

                br.sendSuccess(res, configItemDetails, 'Ledger Period Control updated successfully!');

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
 * /api/v1/config/ledger-period-control/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Ledger Period Control]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, ledgerPeriodControlMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'ledgerId',
                'accountingPeriod',
                'periodClosedStatus',
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configLedgerPeriodControlSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ledger-period-control/get-all:
 *  get:
 *      summary: Get all Ledger Period Control
 *      tags: [Config-Ledger Period Control]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Ledger Period Control using ledgerId
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, ledgerPeriodControlMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.ledgerId = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await LedgerPeriodControlModel.find(filter).populate(['ledgerId', 'accountingPeriod']);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ledger-period-control/get/{id}:
 *  get:
 *      summary: get Ledger Period Control details by id
 *      tags: [Config-Ledger Period Control]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ledger Period Control Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, ledgerPeriodControlMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await LedgerPeriodControlModel.find({
            _id: id,
            isDeleted: false
        }).populate(['ledgerId', 'accountingPeriod']);

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Ledger Period Control with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ledger-period-control/delete/{id}:
 *  delete:
 *      summary: delete Ledger Period Control details by id
 *      tags: [Config-Ledger Period Control]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ledger Period Control Id
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
router.delete("/delete/:id", authUser, ledgerPeriodControlMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await LedgerPeriodControlModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Ledger Period Control with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await LedgerPeriodControlModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await LedgerPeriodControlModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new LedgerPeriodControlAuditModel({
            ledgerId: configItemDetails.ledgerId,
            accountingPeriod: configItemDetails.accountingPeriod,
            periodClosedStatus: configItemDetails.periodClosedStatus,
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

        br.sendSuccess(res, configItemDetails, 'Ledger Period Control deleted successfully!');
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
