const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const { bulkUploader } = require('../helper/file_uploader');
const PortfolioTypeModel = require('../../../models/configPortfolioTypeModel');
const IbCompanyModel = require('../../../models/configIbCompanyModel');
const CurrencyModel = require('../../../models/configCurrencyModel');
const PortfolioGroupModel = require('../../../models/configPortfolioGroupModel');
const PortfolioGroupAuditModel = require('../../../models/configPortfolioGroupAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const portfolioGroupMiddleware = require('../../../middleware/config_portfolio_group_middleware');

/**
 * @swagger
 * /api/v1/config/portfolio-group/add:
 *  post:
 *      summary: Add Portfolio Group
 *      tags: [Config-Portfolio Group]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          id:
 *                              type: string
 *                              default: Asset
 *                          name:
 *                              type: string
 *                              default: Asset
 *                          portfolioGroupType:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          company:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          manager:
 *                              type: string
 *                              default: Asset
 *                          portfolioCurrency:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          endOfYear:
 *                              type: string
 *                              default: 10.25
 *                          portfolioGroupLevelBooking:
 *                              type: boolean
 *                              default: false
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, portfolioGroupMiddleware.canCreate, (req, res) => {
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
 * /api/v1/config/portfolio-group/add/bulk:
 *  post:
 *      summary: Add Bulk Portfolio Group using csv file
 *      tags: [Config-Portfolio Group]
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
router.post("/add/bulk", authUser, portfolioGroupMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Portfolio Group', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        id: 'required|string',
        name: 'required|string',
        portfolioGroupType: 'required|string',
        company: 'required|string',
        manager: 'required|string',
        portfolioCurrency: 'string',
        endOfYear: 'string',
        portfolioGroupLevelBooking: 'boolean',
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
                    portfolioGroupType: inputData.portfolioGroupType.toString().trim(),
                    company: inputData.company.toString().trim(),
                    manager: inputData.manager.toString().trim(),
                    portfolioCurrency: inputData.portfolioCurrency !== undefined ? inputData.portfolioCurrency : null,
                    endOfYear: inputData.endOfYear !== undefined ? inputData.endOfYear.toString().trim() : '',
                    portfolioGroupLevelBooking: helper.getBoolean(inputData.portfolioGroupLevelBooking),
                };

                if (!helper.isValidObjectId(data.portfolioGroupType)) {
                    return callback(counter, false, 'portfolioGroupType is not a valid Portfolio Type Id!');
                } else {
                    const itemDetails = await PortfolioTypeModel
                        .find({_id: data.portfolioGroupType, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Portfolio Group Id for portfolioGroupType => ' + data.portfolioGroupType + '!');
                    }
                }

                if (!helper.isValidObjectId(data.company)) {
                    return callback(counter, false, 'company is not a valid Ib Company Id!');
                } else {
                    const itemDetails = await IbCompanyModel
                        .find({_id: data.company, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Ib Company Id for company => ' + data.company + '!');
                    }
                }

                if (helper.isValidObjectId(data.portfolioCurrency)) {
                    const itemDetails = await CurrencyModel
                        .find({_id: data.portfolioCurrency, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Currency Id for portfolioCurrency => ' + data.portfolioCurrency + '!');
                    }
                }

                const configFind = await PortfolioGroupModel.find({
                    id: data.id,
                    name: data.name,
                    portfolioGroupType: data.portfolioGroupType,
                    company: data.company,
                }).populate(['portfolioGroupType', 'company']);

                if (configFind.length > 0) {
                    return callback(counter, false, 'Portfolio Group is already '
                        + 'present with Id => `'
                        + configFind[0].id
                        + '` and Name => `'
                        + configFind[0].name
                        + '` and Portfolio Type => `'
                        + configFind[0].portfolioGroupType.name
                        + '` and Company => `'
                        + configFind[0].company.name + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new PortfolioGroupModel({
                    id: data.id,
                    name: data.name,
                    portfolioGroupType: data.portfolioGroupType,
                    company: data.company,
                    manager: data.manager,
                    portfolioCurrency: data.portfolioCurrency,
                    endOfYear: data.endOfYear,
                    portfolioGroupLevelBooking: data.portfolioGroupLevelBooking,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new PortfolioGroupAuditModel({
                    id: ib.id,
                    name: ib.name,
                    portfolioGroupType: ib.portfolioGroupType,
                    company: ib.company,
                    manager: ib.manager,
                    portfolioCurrency: ib.portfolioCurrency,
                    endOfYear: ib.endOfYear,
                    portfolioGroupLevelBooking: ib.portfolioGroupLevelBooking,
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

                callback(counter, true, 'Portfolio Group added successfully!', ib);

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
 * /api/v1/config/portfolio-group/update/{id}:
 *  put:
 *      summary: Update Portfolio Group by id
 *      tags: [Config-Portfolio Group]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Portfolio Group Id
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
 *                              default: Asset
 *                          name:
 *                              type: string
 *                              default: Asset
 *                          portfolioGroupType:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          company:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          manager:
 *                              type: string
 *                              default: Asset
 *                          portfolioCurrency:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          endOfYear:
 *                              type: string
 *                              default: 12.25
 *                          portfolioGroupLevelBooking:
 *                              type: boolean
 *                              default: false
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, portfolioGroupMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        id: 'string',
        name: 'string',
        portfolioGroupType: 'string',
        company: 'string',
        manager: 'string',
        portfolioCurrency: 'string',
        endOfYear: 'string',
        portfolioGroupLevelBooking: 'boolean',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await PortfolioGroupModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Portfolio Group with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.id !== undefined) {
                    data.id = req.body.id.toString().trim();
                }
                if (req.body.name !== undefined) {
                    data.name = req.body.name.toString().trim();
                }

                if (req.body.portfolioGroupType !== undefined) {
                    data.portfolioGroupType = req.body.portfolioGroupType.toString().trim();

                    if (!helper.isValidObjectId(data.portfolioGroupType)) {
                        return br.sendNotSuccessful(res, 'portfolioGroupType is not a valid Portfolio Type Id!');
                    } else {
                        const itemDetails = await PortfolioTypeModel
                            .find({_id: data.portfolioGroupType, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Portfolio Type Id for portfolioGroupType => ' + data.portfolioGroupType + '!');
                        }
                    }
                }

                if (req.body.company !== undefined) {
                    data.company = req.body.company.toString().trim();

                    if (!helper.isValidObjectId(data.company)) {
                        return br.sendNotSuccessful(res, 'company is not a valid Ib Company Id!');
                    } else {
                        const itemDetails = await IbCompanyModel
                            .find({_id: data.company, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Ib Company Id for company => ' + data.company + '!');
                        }
                    }
                }

                if (req.body.portfolioCurrency !== undefined) {
                    data.portfolioCurrency = req.body.portfolioCurrency.toString().trim();

                    if (helper.isValidObjectId(data.portfolioCurrency)) {
                        const itemDetails = await CurrencyModel
                            .find({_id: data.portfolioCurrency, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Currency Id for portfolioCurrency => ' + data.portfolioCurrency + '!');
                        }
                    }
                }

                if (req.body.manager !== undefined) {
                    data.manager = req.body.manager.toString().trim();
                }

                if (req.body.endOfYear !== undefined) {
                    data.endOfYear = req.body.endOfYear.toString().trim();
                }

                if (req.body.portfolioGroupLevelBooking !== undefined) {
                    data.portfolioGroupLevelBooking = helper.getBoolean(req.body.portfolioGroupLevelBooking);
                }

                let configFind = await PortfolioGroupModel.find({
                    _id: {
                        $nin: id
                    },
                    id: data.id !== undefined
                        ? data.id
                        : configItem.id,
                    name: data.name !== undefined
                        ? data.name
                        : configItem.name,
                    portfolioGroupType: data.portfolioGroupType !== undefined
                        ? data.portfolioGroupType
                        : configItem.portfolioGroupType,
                    company: data.company !== undefined
                        ? data.company
                        : configItem.company
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Portfolio Group is already '
                        + 'present with Id => `'
                        + configFind[0].id
                        + '` and Name => `'
                        + configFind[0].name
                        + '` and Portfolio Type => `'
                        + configFind[0].portfolioGroupType.portfolioType
                        + '` and Company => `'
                        + configFind[0].company.name + ' !',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await PortfolioGroupModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await PortfolioGroupModel.find({_id: id, isDeleted: false}).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new PortfolioGroupAuditModel({
                    id: configItemDetails.id,
                    name: configItemDetails.name,
                    portfolioGroupType: configItemDetails.portfolioGroupType,
                    company: configItemDetails.company,
                    manager: configItemDetails.manager,
                    portfolioCurrency: configItemDetails.portfolioCurrency,
                    endOfYear: configItemDetails.endOfYear,
                    portfolioGroupLevelBooking: configItemDetails.portfolioGroupLevelBooking,
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

                br.sendSuccess(res, configItemDetails, 'Portfolio Group updated successfully!');

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
 * /api/v1/config/portfolio-group/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Portfolio Group]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, abFrameworkMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'id',
                'name',
                'portfolioGroupType',
                'company',
                'manager',
                'portfolioCurrency',
                'endOfYear',
                'portfolioGroupLevelBooking'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configPortfolioGroupInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/portfolio-group/get-all:
 *  get:
 *      summary: Get all Portfolio Group
 *      tags: [Config-Portfolio Group]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Portfolio Group using name
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, portfolioGroupMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.name = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await PortfolioGroupModel.find(filter).populate(['portfolioGroupType', 'company', 'portfolioCurrency']);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/portfolio-group/get/{id}:
 *  get:
 *      summary: get Portfolio Group details by id
 *      tags: [Config-Portfolio Group]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Portfolio Group Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, portfolioGroupMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await PortfolioGroupModel.find({
            _id: id,
            isDeleted: false
        }).populate(['portfolioGroupType', 'company', 'portfolioCurrency']);

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Portfolio Group with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/portfolio-group/delete/{id}:
 *  delete:
 *      summary: delete Portfolio Group details by id
 *      tags: [Config-Portfolio Group]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Portfolio Group Id
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
router.delete("/delete/:id", authUser, portfolioGroupMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await PortfolioGroupModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Portfolio Group with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await PortfolioGroupModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await PortfolioGroupModel.find({_id: id}).populate(['portfolioGroupType', 'company', 'portfolioCurrency']).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new PortfolioGroupAuditModel({
            id: configItemDetails.id,
            name: configItemDetails.name,
            portfolioGroupType: configItemDetails.portfolioGroupType,
            company: configItemDetails.company,
            manager: configItemDetails.manager,
            portfolioCurrency: configItemDetails.portfolioCurrency,
            endOfYear: configItemDetails.endOfYear,
            portfolioGroupLevelBooking: configItemDetails.portfolioGroupLevelBooking,
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

        br.sendSuccess(res, configItemDetails, 'Portfolio Group deleted successfully!');
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
