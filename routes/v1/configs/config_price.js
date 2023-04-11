const express = require("express");
const mongo = require("mongoose");
const moment = require('moment');
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const { bulkUploader } = require('../helper/file_uploader');
const CurrencyModel = require('../../../models/configCurrencyModel');
const PriceModel = require('../../../models/configPriceModel');
const PriceAuditModel = require('../../../models/configPriceAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const priceMiddleware = require('../../../middleware/config_price_middleware');

/**
 * @swagger
 * /api/v1/config/price/add:
 *  post:
 *      summary: Add Price
 *      tags: [Config-Price]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          securityId:
 *                              type: string
 *                              default: DFUHE
 *                          priceType:
 *                              type: string
 *                              default: ANY
 *                          priceDate:
 *                              type: string
 *                              default: 2022-6-12
 *                          price:
 *                              type: double
 *                              min: 0
 *                              default: 0
 *                          currency:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, priceMiddleware.canCreate, (req, res) => {
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
 * /api/v1/config/price/add/bulk:
 *  post:
 *      summary: Add Bulk Price using csv file
 *      tags: [Config-Price]
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
router.post("/add/bulk", authUser, priceMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Price', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        securityId: 'required|string',
        priceType: 'required|string',
        priceDate: 'required|string',
        price: 'required|numeric',
        currency: 'required|string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    securityId: inputData.securityId.toString().trim(),
                    priceType: inputData.priceType.toString().trim(),
                    priceDate: moment(inputData.priceDate),
                    price: parseFloat(inputData.price !== undefined ? inputData.price.toString() : 0),
                    currency: inputData.currency.toString().trim(),
                };

                if (!data.priceDate.isValid()) {
                    return callback(counter, false, 'priceDate is not a valid date!');
                } else {
                    data.priceDate = new Date(moment(data.priceDate).format());
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

                const configFind = await PriceModel.find({
                    securityId: data.securityId,
                    priceType: data.priceType,
                    priceDate: data.priceDate,
                    currency: data.currency,
                }).populate('currency');

                if (configFind.length > 0) {
                    return callback(counter, false, 'Price is already '
                        + 'present with securityId => `'
                        + configFind[0].securityId
                        + '` and priceType => `'
                        + configFind[0].priceType
                        + '` and priceDate => `'
                        + configFind[0].priceDate.toString()
                        + '` and Currency => `'
                        + configFind[0].currency.currencyName + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new PriceModel({
                    securityId: data.securityId,
                    priceType: data.priceType,
                    priceDate: data.priceDate,
                    price: data.price,
                    currency: data.currency,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new PriceAuditModel({
                    slNo: ib.slNo,
                    securityId: ib.securityId,
                    priceType: ib.priceType,
                    priceDate: ib.priceDate,
                    price: ib.price,
                    currency: ib.currency,
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

                callback(counter, true, 'Price added successfully!', ib);

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
 * /api/v1/config/price/update/{id}:
 *  put:
 *      summary: Update Price by id
 *      tags: [Config-Price]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Price Id
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
 *                              default: DFUHE
 *                          priceType:
 *                              type: string
 *                              default: ANY
 *                          priceDate:
 *                              type: string
 *                              default: 2022-6-12
 *                          price:
 *                              type: double
 *                              min: 0
 *                              default: 0
 *                          currency:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, priceMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        securityId: 'string',
        priceType: 'string',
        priceDate: 'string',
        price: 'numeric',
        currency: 'string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await PriceModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Price with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.securityId !== undefined) {
                    data.securityId = req.body.securityId.toString().trim();
                }

                if (req.body.priceType !== undefined) {
                    data.priceType = req.body.priceType.toString().trim();
                }

                if (req.body.priceDate !== undefined) {
                    data.priceDate = moment(req.body.priceDate);

                    if (!data.priceDate.isValid()) {
                        return br.sendNotSuccessful(res, 'priceDate is not a valid date!');
                    } else {
                        data.priceDate = new Date(moment(data.priceDate).format());
                    }
                }

                if (req.body.price !== undefined) {
                    data.price = parseFloat(req.body.price);
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

                let configFind = await PriceModel.find({
                    _id: {
                        $nin: id
                    },
                    securityId: data.securityId !== undefined
                        ? data.securityId
                        : configItem.securityId,
                    priceType: data.priceType !== undefined
                        ? data.priceType
                        : configItem.priceType,
                    priceDate: data.priceDate !== undefined
                        ? data.priceDate
                        : configItem.priceDate,
                    currency: data.currency !== undefined
                        ? data.currency
                        : configItem.currency
                }).populate('currency');

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Price is already '
                        + 'present with securityId => `'
                        + configFind[0].securityId
                        + '` and priceType => `'
                        + configFind[0].priceType
                        + '` and priceDate => `'
                        + configFind[0].priceDate.toString()
                        + '` and Currency => `'
                        + configFind[0].currency.currencyName + ' !',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await PriceModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await PriceModel.find({
                    _id: id,
                    isDeleted: false
                }).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new PriceAuditModel({
                    slNo: configItemDetails.slNo,
                    securityId: configItemDetails.securityId,
                    priceType: configItemDetails.priceType,
                    priceDate: configItemDetails.priceDate,
                    currency: configItemDetails.currency,
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

                br.sendSuccess(res, configItemDetails, 'Price updated successfully!');

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
 * /api/v1/config/price/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Price]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, priceMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'slNo',
                'securityId',
                'priceType',
                'priceDate',
                'currency',
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configPriceInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/price/get-all:
 *  get:
 *      summary: Get all Price
 *      tags: [Config-Price]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Price using securityId
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, priceMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.securityId = {
                $regex: new RegExp('^' + req.query.search, 'i'),
            }
        }

        let assets = await PriceModel.find(filter).populate( 'currency');
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/price/get/{id}:
 *  get:
 *      summary: get Price details by id
 *      tags: [Config-Price]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Price Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, priceMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await PriceModel.find({
            _id: id,
            isDeleted: false
        }).populate('currency');

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Price with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/price/delete/{id}:
 *  delete:
 *      summary: delete Price details by id
 *      tags: [Config-Price]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Price Id
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
router.delete("/delete/:id", authUser, priceMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await PriceModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Price with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await PriceModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await PriceModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new PriceAuditModel({
            slNo: configItemDetails.slNo,
            securityId: configItemDetails.securityId,
            priceType: configItemDetails.priceType,
            priceDate: configItemDetails.priceDate,
            currency: configItemDetails.currency,
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

        br.sendSuccess(res, configItemDetails, 'Price deleted successfully!');
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
