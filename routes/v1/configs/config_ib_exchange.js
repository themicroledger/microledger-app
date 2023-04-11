const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const { bulkUploader } = require('../helper/file_uploader');
const HolidayModel = require('../../../models/configCalenderOrBankHolidayModel');
const IbExchangeModel = require('../../../models/configIbExchangeModel');
const IbExchangeAuditModel = require('../../../models/configIbExchangeAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const ibExchangeMiddleware = require('../../../middleware/config_ib_exchange_middleware');

/**
 * @swagger
 * /api/v1/config/ib-exchange/add:
 *  post:
 *      summary: Add Ib Exchange
 *      tags: [Config-Ib Exchange]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          id:
 *                              type: string
 *                              default: XNYS
 *                          name:
 *                              type: string
 *                              default: New york Stock Market
 *                          country:
 *                              type: string
 *                              default: US
 *                          holidayCalender:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          realStockExchange:
 *                              type: boolean
 *                              default: false
 *                          iso10383Mic:
 *                              type: string
 *                              default: XNYS
 *                          iso10383Accr:
 *                              type: string
 *                              default: NYSE
 *                          reutersExchangeCode:
 *                              type: string
 *                              default: NYS
 *                          swift:
 *                              type: string
 *                              default: BIC0123456
 *                          exchangeClientSpecificCodes:
 *                              type: array
 *                              items:
 *                                  type: object
 *                                  properties:
 *                                      key:
 *                                          type: string
 *                                          default: adios
 *                                      val:
 *                                          type: integer
 *                                          default: 1
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, ibExchangeMiddleware.canCreate, (req, res) => {
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
 * /api/v1/config/ib-exchange/add/bulk:
 *  post:
 *      summary: Add Bulk Ib Exchange using csv file
 *      tags: [Config-Ib Exchange]
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
router.post("/add/bulk", authUser, ibExchangeMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Ib Exchange', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        id: 'required|string',
        name: 'required|string',
        country: 'required|string',
        holidayCalender: 'required|string',
        realStockExchange: 'required|boolean',
        iso10383Mic: 'string',
        iso10383Accr: 'string',
        reutersExchangeCode: 'string',
        swift: 'string',
        exchangeClientSpecificCodes: 'array',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    id: inputData.id.toString().trim(),
                    name: inputData.name.toString().trim(),
                    country: inputData.country.toString().trim(),
                    holidayCalender: inputData.holidayCalender.toString().trim(),
                    realStockExchange: helper.getBoolean(inputData.realStockExchange),
                    iso10383Mic: inputData.iso10383Mic !== undefined ? inputData.iso10383Mic.toString().trim() : '',
                    iso10383Accr: inputData.iso10383Accr !== undefined ? inputData.iso10383Accr.toString().trim() : '',
                    reutersExchangeCode: inputData.reutersExchangeCode !== undefined ? inputData.reutersExchangeCode.toString().trim() : '',
                    swift: inputData.swift !== undefined ? inputData.swift.toString().trim() : '',
                    exchangeClientSpecificCodes: inputData.exchangeClientSpecificCodes !== undefined ? inputData.exchangeClientSpecificCodes : [],
                };

                if (!helper.isValidObjectId(data.holidayCalender)) {
                    return callback(counter, false, 'holidayCalender is not a valid Calender Or Bank Holiday Id!');
                } else {
                    const itemDetails = await HolidayModel
                        .find({_id: data.holidayCalender, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Calender Or Bank Holiday Id for holidayCalender => ' + data.holidayCalender + '!');
                    }
                }

                if(!Array.isArray(data.exchangeClientSpecificCodes)){
                    return callback(counter, false, 'exchangeClientSpecificCodes is not an array');
                }

                const configFind = await IbExchangeModel.find({
                    id: data.id,
                    name: data.name,
                    holidayCalender: data.holidayCalender,
                });

                if (configFind.length > 0) {
                    return callback(counter, false, 'Ib Exchange is already '
                        + 'present with id => `'
                        + configFind[0].id
                        + '` and name => `'
                        + configFind[0].name
                        + '` and holidayCalender => `'
                        + configFind[0].holidayCalender.name + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new IbExchangeModel({
                    id: data.id,
                    name: data.name,
                    country: data.country,
                    holidayCalender: data.holidayCalender,
                    realStockExchange: data.realStockExchange,
                    iso10383Mic: data.iso10383Mic,
                    iso10383Accr: data.iso10383Accr,
                    reutersExchangeCode: data.reutersExchangeCode,
                    swift: data.swift,
                    exchangeClientSpecificCodes: data.exchangeClientSpecificCodes,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new IbExchangeAuditModel({
                    id: ib.id,
                    name: ib.name,
                    country: ib.country,
                    holidayCalender: ib.holidayCalender,
                    realStockExchange: ib.realStockExchange,
                    iso10383Mic: ib.iso10383Mic,
                    iso10383Accr: ib.iso10383Accr,
                    reutersExchangeCode: ib.reutersExchangeCode,
                    swift: ib.swift,
                    exchangeClientSpecificCodes: ib.exchangeClientSpecificCodes,
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

                callback(counter, true, 'Ib Exchange added successfully!', ib);

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
 * /api/v1/config/ib-exchange/update/{id}:
 *  put:
 *      summary: Update Ib Exchange by id
 *      tags: [Config-Ib Exchange]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Exchange Id
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
 *                              default: XNYS
 *                          name:
 *                              type: string
 *                              default: New york Stock Market
 *                          country:
 *                              type: string
 *                              default: US
 *                          holidayCalender:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          realStockExchange:
 *                              type: boolean
 *                              default: false
 *                          iso10383Mic:
 *                              type: string
 *                              default: XNYS
 *                          iso10383Accr:
 *                              type: string
 *                              default: NYSE
 *                          reutersExchangeCode:
 *                              type: string
 *                              default: NYS
 *                          swift:
 *                              type: string
 *                              default: BIC0123456
 *                          exchangeClientSpecificCodes:
 *                              type: array
 *                              items:
 *                                  type: object
 *                                  properties:
 *                                      key:
 *                                          type: string
 *                                          default: adios
 *                                      val:
 *                                          type: integer
 *                                          default: 1
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, ibExchangeMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        id: 'string',
        name: 'string',
        country: 'string',
        holidayCalender: 'string',
        realStockExchange: 'boolean',
        iso10383Mic: 'string',
        iso10383Accr: 'string',
        reutersExchangeCode: 'string',
        swift: 'string',
        exchangeClientSpecificCodes: 'array',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await IbExchangeModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Ib Exchange with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.id !== undefined) {
                    data.id = req.body.id.toString().trim();
                }

                if (req.body.name !== undefined) {
                    data.name = req.body.name.toString().trim();
                }

                if (req.body.country !== undefined) {
                    data.country = req.body.country.toString().trim();
                }

                if (req.body.holidayCalender !== undefined) {
                    data.holidayCalender = req.body.holidayCalender.toString().trim();

                    if (!helper.isValidObjectId(data.holidayCalender)) {
                        return br.sendNotSuccessful(res, 'holidayCalender is not a valid Calender Or Bank Holiday Id!');
                    } else {
                        const itemDetails = await HolidayModel
                            .find({_id: data.holidayCalender, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Calender Or Bank Holiday Id for holidayCalender => ' + data.holidayCalender + '!');
                        }
                    }
                }

                if (req.body.realStockExchange !== undefined) {
                    data.realStockExchange = helper.getBoolean(req.body.realStockExchange);
                }

                if (req.body.iso10383Mic !== undefined) {
                    data.iso10383Mic = req.body.iso10383Mic.toString().trim();
                }

                if (req.body.iso10383Accr !== undefined) {
                    data.iso10383Accr = req.body.iso10383Accr.toString().trim();
                }

                if (req.body.reutersExchangeCode !== undefined) {
                    data.reutersExchangeCode = req.body.reutersExchangeCode.toString().trim();
                }

                if (req.body.swift !== undefined) {
                    data.swift = req.body.swift.toString().trim();
                }

                if (req.body.exchangeClientSpecificCodes !== undefined && Array.isArray(req.body.exchangeClientSpecificCodes)) {
                    let codes = [];
                    data.exchangeClientSpecificCodes.forEach((item) => {
                        if(item.key !== undefined && item.val !== undefined){
                            codes.push({
                                key: item.key,
                                val: item.val
                            });
                        }
                    });
                    data.exchangeClientSpecificCodes = codes;
                }

                let configFind = await IbExchangeModel.find({
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
                    return br.sendNotSuccessful(res, 'Ib Exchange is already '
                        + 'present with id => `'
                        + configFind[0].id
                        + '` and name => `'
                        + configFind[0].name
                        + '` and holidayCalender => `'
                        + configFind[0].holidayCalender.name + ' !',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await IbExchangeModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await IbExchangeModel.find({
                    _id: id,
                    isDeleted: false
                }).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new IbExchangeAuditModel({
                    id: configItemDetails.id,
                    name: configItemDetails.name,
                    country: configItemDetails.country,
                    holidayCalender: configItemDetails.holidayCalender,
                    realStockExchange: configItemDetails.realStockExchange,
                    iso10383Mic: configItemDetails.iso10383Mic,
                    iso10383Accr: configItemDetails.iso10383Accr,
                    reutersExchangeCode: configItemDetails.reutersExchangeCode,
                    swift: configItemDetails.swift,
                    exchangeClientSpecificCodes: configItemDetails.exchangeClientSpecificCodes,
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

                br.sendSuccess(res, configItemDetails, 'Ib Exchange updated successfully!');

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
 * /api/v1/config/ib-exchange/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Ib Exchange]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, ibExchangeMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'id',
                'name',
                'country',
                'holidayCalender',
                'realStockExchange',
                'iso10383Mic',
                'iso10383Accr',
                'reutersExchangeCode',
                'swift',
                'exchangeClientSpecificCodes',
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configIbExchangeInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-exchange/get-all:
 *  get:
 *      summary: Get all Ib Exchange
 *      tags: [Config-Ib Exchange]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Ib Exchange using name
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, ibExchangeMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.name = {
                $regex: new RegExp('^' + req.query.search, 'i'),
            }
        }

        let assets = await IbExchangeModel.find(filter).populate('holidayCalender');
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-exchange/get-all/for/holiday-calender/{id}:
 *  get:
 *      summary: Get all Ib Exchange got any Holiday Calender
 *      tags: [Config-Ib Exchange]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Bank Calender Holiday Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all/for/holiday-calender/:id", authUser, ibExchangeMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;

        let filter = {
            holidayCalender: id,
            isDeleted: false,
        }

        let assets = await IbExchangeModel.find(filter).populate('holidayCalender');
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-exchange/get/{id}:
 *  get:
 *      summary: get Ib Exchange details by id
 *      tags: [Config-Ib Exchange]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Exchange Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, ibExchangeMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await IbExchangeModel.find({
            _id: id,
            isDeleted: false
        }).populate('holidayCalender');

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Ib Exchange with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-exchange/delete/{id}:
 *  delete:
 *      summary: delete Ib Exchange details by id
 *      tags: [Config-Ib Exchange]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Exchange Id
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
router.delete("/delete/:id", authUser, ibExchangeMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await IbExchangeModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Ib Exchange with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await IbExchangeModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await IbExchangeModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new IbExchangeAuditModel({
            id: configItemDetails.id,
            name: configItemDetails.name,
            country: configItemDetails.country,
            holidayCalender: configItemDetails.holidayCalender,
            realStockExchange: configItemDetails.realStockExchange,
            iso10383Mic: configItemDetails.iso10383Mic,
            iso10383Accr: configItemDetails.iso10383Accr,
            reutersExchangeCode: configItemDetails.reutersExchangeCode,
            swift: configItemDetails.swift,
            exchangeClientSpecificCodes: configItemDetails.exchangeClientSpecificCodes,
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

        br.sendSuccess(res, configItemDetails, 'Ib Exchange deleted successfully!');
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
