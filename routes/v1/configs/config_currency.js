const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const json2csv = require('json2csv').parse;
const { bulkUploader } = require('../helper/file_uploader');
const {processBulkInsert} = require('../helper/process_bulk_insert');
const IbCalenderOrBankHolidayModel = require('../../../models/configCalenderOrBankHolidayModel');
const currencyModel = require('../../../models/configCurrencyModel');
const currencyAuditModel = require('../../../models/configCurrencyAuditModel');
const {Validator} = require('node-input-validator');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const currencyMiddleware = require('../../../middleware/config_currency_middleware');

/**
 * @swagger
 * /api/v1/config/currency/add:
 *  post:
 *      summary: Add Currency
 *      tags: [Config-Currency]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          currency:
 *                              type: string
 *                              default: USD
 *                          currencyName:
 *                              type: string
 *                              default: USD Dollar
 *                          bankHolidays:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          settlementDays:
 *                              type: integer
 *                              default: 2
 *                          ISDACurrencyNotation:
 *                              type: string
 *                              default: USD
 *                          decimals:
 *                              type: integer
 *                              default: 2
 *                          roundingTruncation:
 *                              type: boolean
 *                              default: false
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, currencyMiddleware.canCreate, (req, res) => {

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
 * /api/v1/config/currency/add/bulk:
 *  post:
 *      summary: Add Bulk Currency Type using csv file
 *      tags: [Config-Currency]
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
router.post("/add/bulk", authUser, currencyMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Currency', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {

    const v = new Validator(req.body, {
        currency: 'required|string|maxLength:50',
        currencyName: 'required|string|maxLength:50',
        bankHolidays: 'required|string',
        settlementDays: 'required|integer',
        ISDACurrencyNotation: 'required|string',
        decimals: 'required|integer',
        roundingTruncation: 'required|boolean'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    currency: inputData.currency.toString().trim(),
                    currencyName: inputData.currencyName.toString().trim(),
                    bankHolidays: inputData.bankHolidays.toString().trim(),
                    settlementDays: inputData.settlementDays.toString().trim(),
                    ISDACurrencyNotation: inputData.ISDACurrencyNotation.toString().trim(),
                    decimals: inputData.decimals.toString().trim(),
                    roundingTruncation: inputData.roundingTruncation.toString().trim(),
                };

                const holidayDetails = await IbCalenderOrBankHolidayModel
                    .find({_id: data.bankHolidays, isDeleted: false,});

                if (holidayDetails.length === 0) {
                    return callback(counter, false, 'Invalid Bank Holiday Id => ' + data.bankHolidays + '!');
                }

                const configFind = await currencyModel.find({
                    currency: data.currency,
                    currencyName: data.currencyName,
                    bankHolidays: data.bankHolidays,
                    ISDACurrencyNotation: data.ISDACurrencyNotation
                }).populate('bankHolidays');

                if (configFind.length > 0) {
                    return callback(counter, false, 'Currency is already '
                        + 'present with Currency => `'
                        + configFind[0].currency
                        + '` and Currency Name => `'
                        + configFind[0].currencyName
                        + '` and Holiday Calender Name => `'
                        + configFind[0].bankHolidays.calenderName
                        + '` and ISDA Currency Notation => `'
                        + configFind[0].ISDACurrencyNotation + '!',
                        {});
                }

                await session.startTransaction();

                const ib = new currencyModel({
                    currency: data.currency,
                    currencyName: data.currencyName,
                    bankHolidays: data.bankHolidays,
                    settlementDays: data.settlementDays,
                    ISDACurrencyNotation: data.ISDACurrencyNotation,
                    decimals: data.decimals,
                    roundingTruncation: data.roundingTruncation,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new currencyAuditModel({
                    currency: ib.currency,
                    currencyName: ib.currencyName,
                    bankHolidays: ib.bankHolidays,
                    settlementDays: ib.settlementDays,
                    ISDACurrencyNotation: ib.ISDACurrencyNotation,
                    decimals: ib.decimals,
                    roundingTruncation: ib.roundingTruncation,
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

                callback(counter, true, 'Currency added successfully!', ib);

            } catch (error) {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                onError(counter, error);
            } finally {
                await session.endSession();
            }
        }
    });

}

/**
 * @swagger
 * /api/v1/config/currency/update/{id}:
 *  put:
 *      summary: Update Currency by id
 *      tags: [Config-Currency]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Currency Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          currency:
 *                              type: string
 *                              default: USD
 *                          currencyName:
 *                              type: string
 *                              default: USD Dollar
 *                          bankHolidays:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          settlementDays:
 *                              type: integer
 *                              default: 2
 *                          ISDACurrencyNotation:
 *                              type: string
 *                              default: USD
 *                          decimals:
 *                              type: integer
 *                              default: 2
 *                          roundingTruncation:
 *                              type: boolean
 *                              default: false
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, currencyMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        currency: 'string|maxLength:50',
        currencyName: 'string|maxLength:50',
        bankHolidays: 'string',
        settlementDays: 'integer',
        ISDACurrencyNotation: 'string',
        decimals: 'integer',
        roundingTruncation: 'boolean'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await currencyModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Currency with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.currency !== undefined) {
                    data.currency = req.body.currency.toString().trim();
                }

                if (req.body.currencyName !== undefined) {
                    data.currencyName = req.body.currencyName.toString().trim();
                }

                if (req.body.bankHolidays !== undefined) {
                    data.bankHolidays = req.body.bankHolidays.toString().trim();

                    const holidayDetails = await IbCalenderOrBankHolidayModel
                        .find({_id: data.bankHolidays, isDeleted: false,});

                    if (holidayDetails.length === 0) {
                        return br.sendNotSuccessful(res, 'Invalid Bank Holiday Id => ' + data.bankHolidays + '!');
                    }
                }

                if (req.body.settlementDays !== undefined) {
                    data.settlementDays = parseInt(req.body.settlementDays.toString().trim());
                }

                if (req.body.ISDACurrencyNotation !== undefined) {
                    data.ISDACurrencyNotation = req.body.ISDACurrencyNotation.toString().trim();
                }

                if (req.body.decimals !== undefined) {
                    data.decimals = parseInt(req.body.decimals.toString().trim());
                }

                if (req.body.roundingTruncation !== undefined) {
                    data.roundingTruncation = helper.getBoolean(req.body.roundingTruncation);
                }

                let configFind = await currencyModel.find({
                    _id: {
                        $nin: id
                    },
                    currency: data.currency !== undefined
                        ? data.currency
                        : configItem.currency,
                    currencyName: data.currencyName !== undefined
                        ? data.currencyName
                        : configItem.currencyName,
                    bankHolidays: data.bankHolidays !== undefined
                        ? data.bankHolidays
                        : configItem.bankHolidays,
                    ISDACurrencyNotation: data.ISDACurrencyNotation !== undefined
                        ? data.ISDACurrencyNotation
                        : configItem.ISDACurrencyNotation
                }).populate('bankHolidays');

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Currency is already '
                        + 'present with Currency => `'
                        + configFind[0].currency
                        + '` and Currency Name => `'
                        + configFind[0].currencyName
                        + '` and Holiday Calender Name => `'
                        + configFind[0].bankHolidays.calenderName
                        + '` and ISDA Currency Notation => `'
                        + configFind[0].ISDACurrencyNotation + '!',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await currencyModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await currencyModel.find({_id: id, isDeleted: false})
                    .populate('bankHolidays').session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new currencyAuditModel({
                    currency: configItemDetails.currency,
                    currencyName: configItemDetails.currencyName,
                    bankHolidays: configItemDetails.bankHolidays,
                    settlementDays: configItemDetails.settlementDays,
                    ISDACurrencyNotation: configItemDetails.ISDACurrencyNotation,
                    decimals: configItemDetails.decimals,
                    roundingTruncation: configItemDetails.roundingTruncation,
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

                br.sendSuccess(res, configItemDetails, 'Currency updated successfully!');

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
 * /api/v1/config/currency/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get Currency Insert sample csv file
 *      tags: [Config-Currency]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, currencyMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([],{
            fields: [
                'currency',
                'currencyName',
                'bankHolidays',
                'settlementDays',
                'ISDACurrencyNotation',
                'decimals',
                'roundingTruncation'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configCurrencySample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/currency/get-all:
 *  get:
 *      summary: Get all Currency
 *      tags: [Config-Currency]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Currency using currencyName
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, currencyMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.curencyName = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await currencyModel.find(filter).populate('bankHolidays');
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/currency/get/{id}:
 *  get:
 *      summary: get Currency details by id
 *      tags: [Config-Currency]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Currency Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, currencyMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let currencyDetails = await currencyModel.find({_id: id, isDeleted: false}).populate('bankHolidays');

        if (currencyDetails.length === 0) {
            return br.sendNotSuccessful(res, `Currency with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, currencyDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/currency/delete/{id}:
 *  delete:
 *      summary: delete Currency details by id
 *      tags: [Config-Currency]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Currency Id
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
router.delete("/delete/:id", authUser, currencyMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await currencyModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Currency with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await currencyModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await currencyModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new currencyAuditModel({
            currency: configItemDetails.currency,
            currencyName: configItemDetails.currencyName,
            bankHolidays: configItemDetails.bankHolidays,
            settlementDays: configItemDetails.settlementDays,
            ISDACurrencyNotation: configItemDetails.ISDACurrencyNotation,
            decimals: configItemDetails.decimals,
            roundingTruncation: configItemDetails.roundingTruncation,
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

        br.sendSuccess(res, configItemDetails, 'Currency deleted successfully!');
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
