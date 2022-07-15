const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const uploader = require('../helper/file_uploader');
const CalenderOrBankHolidayModel = require('../../../models/configCalenderOrBankHolidayModel');
const CurrencyModel = require('../../../models/configCurrencyModel');
const RefRateDescModel = require('../../../models/configReferenceRatesDescriptionModel');
const RefRateDescAuditModel = require('../../../models/configReferenceRatesDescriptionAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const refRateDescMiddleware = require('../../../middleware/config_reference_rates_description_middleware');

/**
 * @swagger
 * /api/v1/config/reference-rate-description/add:
 *  post:
 *      summary: Add Reference Rate Description
 *      tags: [Config-Reference Rate Description]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          bankHoliday:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          currency:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          referenceRate:
 *                              type: string
 *                              default: SOFR
 *                          referenceRateName:
 *                              type: string
 *                              default: SOFR
 *                          termUnit:
 *                              type: string
 *                              default: Day
 *                              enum: [Month, Years, Days]
 *                          termLength:
 *                              type: integer
 *                              default: 0
 *                          marketIdentifier:
 *                              type: string
 *                              default: SOFR
 *                          pricingSource:
 *                              type: string
 *                              default: Bloomberg
 *                          rateConvention:
 *                              type: string
 *                              default: Money
 *                              enum: [Money, Market, Rate]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, refRateDescMiddleware.canCreate, (req, res) => {
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
 * /api/v1/config/reference-rate-description/add/bulk:
 *  post:
 *      summary: Add Bulk Reference Rate Description using csv file
 *      tags: [Config-Reference Rate Description]
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
router.post("/add/bulk", authUser, refRateDescMiddleware.canCreate, uploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Reference Rate Description', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        bankHoliday: 'required|string',
        currency: 'required|string',
        referenceRate: 'required|string',
        termLength: 'required|string',
        referenceRateName: 'required|string',
        termUnit: 'required|integer',
        marketIdentifier: 'string',
        pricingSource: 'string',
        rateConvention: 'required|string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    bankHoliday: inputData.bankHoliday.toString().trim(),
                    currency: inputData.currency.toString().trim(),
                    referenceRate: inputData.referenceRate.toString().trim(),
                    referenceRateName: inputData.referenceRateName.toString().trim(),
                    termLength: inputData.termLength.toString().trim(),
                    termUnit: parseInt(inputData.termUnit.toString().trim()),
                    marketIdentifier: inputData.marketIdentifier !== undefined ? inputData.marketIdentifier.toString().trim() : '',
                    pricingSource: inputData.pricingSource !== undefined ? inputData.pricingSource.toString().trim() : '',
                    rateConvention: inputData.rateConvention.toString().trim(),
                };


                if (!helper.isValidObjectId(data.bankHoliday)) {
                    return callback(counter, false, 'bankHoliday is not a valid Bank holiday Id!');
                } else {
                    const itemDetails = await CalenderOrBankHolidayModel
                        .find({_id: data.bankHoliday, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Bank holiday Id for bankHoliday => ' + data.bankHoliday + '!');
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

                const configFind = await RefRateDescModel.find({
                    bankHoliday: data.bankHoliday,
                    currency: data.currency,
                    referenceRate: data.referenceRate,
                    referenceRateName: data.referenceRateName,
                }).populate(['bankHoliday', 'currency']);

                if (configFind.length > 0) {
                    return callback(counter, false, 'Reference Rate Description is already '
                        + 'present with Calender or Bank Holiday => `'
                        + configFind[0].currencyName.calenderName
                        + '` and Currency => `'
                        + configFind[0].currency.currencyName
                        + '` and referenceRate => `'
                        + configFind[0].referenceRate
                        + '` and referenceRateName => `'
                        + configFind[0].referenceRateName + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new RefRateDescModel({
                    bankHoliday: data.bankHoliday,
                    currency: data.currency,
                    referenceRate: data.referenceRate,
                    referenceRateName: data.referenceRateName,
                    termLength: data.termLength,
                    termUnit: data.termUnit,
                    marketIdentifier: data.marketIdentifier,
                    pricingSource: data.pricingSource,
                    rateConvention: data.rateConvention,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new RefRateDescAuditModel({
                    bankHoliday: ib.bankHoliday,
                    currency: ib.currency,
                    referenceRate: ib.referenceRate,
                    referenceRateName: ib.referenceRateName,
                    termLength: ib.termLength,
                    termUnit: ib.termUnit,
                    marketIdentifier: ib.marketIdentifier,
                    pricingSource: ib.pricingSource,
                    rateConvention: ib.rateConvention,
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

                callback(counter, true, 'Reference Rate Description added successfully!', ib);

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
 * /api/v1/config/reference-rate-description/update/{id}:
 *  put:
 *      summary: Update Reference Rate Description by id
 *      tags: [Config-Reference Rate Description]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Reference Rate Description Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          bankHoliday:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          currency:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          referenceRate:
 *                              type: string
 *                              default: SOFR
 *                          referenceRateName:
 *                              type: string
 *                              default: SOFR
 *                          termUnit:
 *                              type: integer
 *                              default: 0
 *                          termLength:
 *                              type: string
 *                              default: Day
 *                              enum: [Month, Years, Days]
 *                          marketIdentifier:
 *                              type: string
 *                              default: SOFR
 *                          pricingSource:
 *                              type: string
 *                              default: Bloomberg
 *                          rateConvention:
 *                              type: string
 *                              default: Money
 *                              enum: [Money, Market, Rate]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, refRateDescMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        bankHoliday: 'string',
        currency: 'string',
        referenceRate: 'string',
        referenceRateName: 'string',
        termUnit: 'string',
        termLength: 'integer',
        marketIdentifier: 'string',
        pricingSource: 'string',
        rateConvention: 'string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await RefRateDescModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Reference Rate Description with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.bankHoliday !== undefined) {
                    data.bankHoliday = req.body.bankHoliday.toString().trim();

                    if (!helper.isValidObjectId(data.bankHoliday)) {
                        return br.sendNotSuccessful(res, 'bankHoliday is not a valid Calender Or Bank Holiday Id!');
                    } else {
                        const itemDetails = await CalenderOrBankHolidayModel
                            .find({_id: data.bankHoliday, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Calender Or Bank holiday Id for bankHoliday => ' + data.bankHoliday + '!');
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
                            return br.sendNotSuccessful(res, 'Invalid Currency Id for currency => ' + data.currency + '!');
                        }
                    }
                }

                if (req.body.referenceRate !== undefined) {
                    data.referenceRate = req.body.referenceRate.toString().trim();
                }

                if (req.body.referenceRateName !== undefined) {
                    data.referenceRateName = req.body.referenceRateName.toString().trim();
                }

                if (req.body.termUnit !== undefined) {
                    data.termUnit = parseInt(req.body.termUnit);
                }

                if (req.body.termLength !== undefined && helper.isObjectContainsKey(helper.sysConst.referenceTermLength, req.body.termLength)) {
                    data.termLength = req.body.termLength.toString().trim();
                }

                if (req.body.marketIdentifier !== undefined) {
                    data.marketIdentifier = req.body.marketIdentifier.toString().trim();
                }

                if (req.body.pricingSource !== undefined) {
                    data.pricingSource = req.body.pricingSource.toString().trim();
                }

                if (req.body.rateConvention !== undefined && helper.isObjectContainsKey(helper.sysConst.referenceRateConvention, req.body.rateConvention)) {
                    data.rateConvention = req.body.rateConvention.toString().trim();
                }

                let configFind = await RefRateDescModel.find({
                    _id: {
                        $nin: id
                    },
                    bankHoliday: data.bankHoliday !== undefined
                        ? data.bankHoliday
                        : configItem.bankHoliday,
                    currency: data.currency !== undefined
                        ? data.currency
                        : configItem.currency,
                    referenceRate: data.referenceRate !== undefined
                        ? data.referenceRate
                        : configItem.referenceRate,
                    referenceRateName: data.referenceRateName !== undefined
                        ? data.referenceRateName
                        : configItem.referenceRateName
                }).populate(['bankHoliday', 'currency']);

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Reference Rate Description is already '
                        + 'present with Calender or Bank Holiday => `'
                        + configFind[0].currencyName.calenderName
                        + '` and Currency => `'
                        + configFind[0].currency.currencyName
                        + '` and referenceRate => `'
                        + configFind[0].referenceRate
                        + '` and referenceRateName => `'
                        + configFind[0].referenceRateName + ' !',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await RefRateDescModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await RefRateDescModel.find({
                    _id: id,
                    isDeleted: false
                }).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new RefRateDescAuditModel({
                    bankHoliday: configItemDetails.bankHoliday,
                    currency: configItemDetails.currency,
                    referenceRate: configItemDetails.referenceRate,
                    referenceRateName: configItemDetails.referenceRateName,
                    termLength: configItemDetails.termLength,
                    termUnit: configItemDetails.termUnit,
                    marketIdentifier: configItemDetails.marketIdentifier,
                    pricingSource: configItemDetails.pricingSource,
                    rateConvention: configItemDetails.rateConvention,
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

                br.sendSuccess(res, configItemDetails, 'Reference Rate Description updated successfully!');

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
 * /api/v1/config/reference-rate-description/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Reference Rate Description]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, refRateDescMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'bankHoliday',
                'currency',
                'referenceRate',
                'referenceRateName',
                'termLength',
                'termUnit',
                'marketIdentifier',
                'pricingSource',
                'rateConvention',
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configReferenceRateDescriptionInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/reference-rate-description/get-all:
 *  get:
 *      summary: Get all Reference Rate Description
 *      tags: [Config-Reference Rate Description]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Reference Rate Description using refRateDescMiddleware
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, refRateDescMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.referenceRateName = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await RefRateDescModel.find(filter).populate(['bankHoliday', 'currency']);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/reference-rate-description/get/{id}:
 *  get:
 *      summary: get Reference Rate Description details by id
 *      tags: [Config-Reference Rate Description]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Reference Rate Description Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, refRateDescMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await RefRateDescModel.find({
            _id: id,
            isDeleted: false
        }).populate(['bankHoliday', 'currency']);

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Reference Rate Description with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/reference-rate-description/delete/{id}:
 *  delete:
 *      summary: delete Reference Rate Description details by id
 *      tags: [Config-Reference Rate Description]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Reference Rate Description Id
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
router.delete("/delete/:id", authUser, refRateDescMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await RefRateDescModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Reference Rate Description with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await RefRateDescModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await RefRateDescModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new RefRateDescAuditModel({
            bankHoliday: configItemDetails.bankHoliday,
            currency: configItemDetails.currency,
            referenceRate: configItemDetails.referenceRate,
            referenceRateName: configItemDetails.referenceRateName,
            termLength: configItemDetails.termLength,
            termUnit: configItemDetails.termUnit,
            marketIdentifier: configItemDetails.marketIdentifier,
            pricingSource: configItemDetails.pricingSource,
            rateConvention: configItemDetails.rateConvention,
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

        br.sendSuccess(res, configItemDetails, 'Reference Rate Description deleted successfully!');
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
