const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const moment = require('moment');
const br = helper.baseResponse;
const router = new express.Router();
const uploader = require('../helper/file_uploader');
const PortfolioGroupModel = require('../../../models/configPortfolioGroupModel');
const PortfolioTypeModel = require('../../../models/configPortfolioTypeModel');
const IbCompanyModel = require('../../../models/configPortfolioTypeModel');
const CurrencyModel = require('../../../models/configCurrencyModel');
const CompanyPortfolioModel = require('../../../models/configCompanyPortfolioModel');
const CompanyPortfolioAuditModel = require('../../../models/configCompanyPortfolioAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const companyPortfolioMiddleware = require('../../../middleware/config_company_portfolio_middleware');

/**
 * @swagger
 * /api/v1/config/company-portfolio/add:
 *  post:
 *      summary: Add Company Portfolio
 *      tags: [Config-Company Portfolio]
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
 *                          portfolioGroup:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
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
 *                              default: 2019-01-22
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, companyPortfolioMiddleware.canCreate, (req, res) => {
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
 * /api/v1/config/company-portfolio/add/bulk:
 *  post:
 *      summary: Add Bulk Company Portfolio using csv file
 *      tags: [Config-Company Portfolio]
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
router.post("/add/bulk", authUser, companyPortfolioMiddleware.canCreate, uploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Company Portfolio', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        id: 'required|string',
        name: 'required|string',
        portfolioGroup: 'required|string',
        portfolioGroupType: 'required|string',
        company: 'required|string',
        manager: 'required|string',
        portfolioCurrency: 'string',
        endOfYear: 'integer',
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
                    portfolioGroup: inputData.portfolioGroup.toString().trim(),
                    portfolioGroupType: inputData.portfolioGroupType.toString().trim(),
                    company: inputData.company.toString().trim(),
                    manager: inputData.manager.toString().trim(),
                    portfolioCurrency: inputData.portfolioCurrency !== undefined ? inputData.portfolioCurrency : null,
                    endOfYear: inputData.endOfYear !== undefined ? inputData.endOfYear : null,
                };

                if (!helper.isValidObjectId(data.portfolioGroup)) {
                    return callback(counter, false, 'portfolioGroup is not a valid Portfolio Group Id!');
                } else {
                    const itemDetails = await PortfolioGroupModel
                        .find({_id: data.portfolioGroup, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Portfolio Group Id for portfolioGroup => ' + data.portfolioGroup + '!');
                    }
                }

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

                const configFind = await CompanyPortfolioModel.find({
                    id: data.id,
                    name: data.name,
                    portfolioGroup: data.portfolioGroup,
                    portfolioGroupType: data.portfolioGroupType,
                    company: data.company,
                }).populate(['portfolioGroup', 'portfolioGroupType', 'company']);

                if (configFind.length > 0) {
                    return callback(counter, false, 'Company Portfolio is already '
                        + 'present with Id => `'
                        + configFind[0].id
                        + '` and Name => `'
                        + configFind[0].name
                        + '` and Portfolio Group => `'
                        + configFind[0].portfolioGroup.name
                        + '` and Portfolio Type => `'
                        + configFind[0].portfolioGroupType.name
                        + '` and Company => `'
                        + configFind[0].company.name + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new CompanyPortfolioModel({
                    id: data.id,
                    name: data.name,
                    portfolioGroup: data.portfolioGroup,
                    portfolioGroupType: data.portfolioGroupType,
                    company: data.company,
                    manager: data.manager,
                    portfolioCurrency: data.portfolioCurrency,
                    endOfYear: data.endOfYear,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new CompanyPortfolioAuditModel({
                    id: ib.id,
                    name: ib.name,
                    portfolioGroup: ib.portfolioGroup,
                    portfolioGroupType: ib.portfolioGroupType,
                    company: ib.company,
                    manager: ib.manager,
                    portfolioCurrency: ib.portfolioCurrency,
                    endOfYear: ib.endOfYear,
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

                callback(counter, true, 'Company Portfolio added successfully!', ib);

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
 * /api/v1/config/company-portfolio/update/{id}:
 *  put:
 *      summary: Update Company Portfolio by id
 *      tags: [Config-Company Portfolio]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Company Portfolio Id
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
 *                          portfolioGroup:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
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
 *                              default: 2019-01-22
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, companyPortfolioMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        id: 'string',
        name: 'string',
        portfolioGroup: 'string',
        portfolioGroupType: 'string',
        company: 'string',
        manager: 'string',
        portfolioCurrency: 'string',
        endOfYear: 'integer',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await CompanyPortfolioModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Company Portfolio with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.id !== undefined) {
                    data.id = req.body.id.toString().trim();
                }
                if (req.body.name !== undefined) {
                    data.name = req.body.name.toString().trim();
                }

                if (req.body.portfolioGroup !== undefined) {
                    data.portfolioGroup = req.body.portfolioGroup.toString().trim();

                    if (!helper.isValidObjectId(data.portfolioGroup)) {
                        return br.sendNotSuccessful(res, 'portfolioGroup is not a valid Portfolio Group Id!');
                    } else {
                        const itemDetails = await PortfolioGroupModel
                            .find({_id: data.portfolioGroup, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Portfolio Group Id for portfolioGroup => ' + data.portfolioGroup + '!');
                        }
                    }
                }

                if (req.body.portfolioGroupType !== undefined) {
                    data.portfolioGroup = req.body.portfolioGroupType.toString().trim();

                    if (!helper.isValidObjectId(data.portfolioGroupType)) {
                        return br.sendNotSuccessful(res, 'portfolioGroupType is not a valid Portfolio Type Id!');
                    } else {
                        const itemDetails = await PortfolioTypeModel
                            .find({_id: data.portfolioGroupType, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Portfolio Group Id for portfolioGroupType => ' + data.portfolioGroupType + '!');
                        }
                    }
                }

                if (req.body.company !== undefined) {
                    data.portfolioGroup = req.body.company.toString().trim();

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
                    data.endOfYear = parseInt(req.body.endOfYear);
                }

                let configFind = await CompanyPortfolioModel.find({
                    _id: {
                        $nin: id
                    },
                    id: data.id !== undefined
                        ? data.id
                        : configItem.id,
                    name: data.name !== undefined
                        ? data.name
                        : configItem.name,
                    portfolioGroup: data.portfolioGroup !== undefined
                        ? data.portfolioGroup
                        : configItem.portfolioGroup,
                    portfolioGroupType: data.portfolioGroupType !== undefined
                        ? data.portfolioGroupType
                        : configItem.portfolioGroupType,
                    company: data.company !== undefined
                        ? data.company
                        : configItem.company
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Company Portfolio is already '
                        + 'present with Id => `'
                        + configFind[0].id
                        + '` and Name => `'
                        + configFind[0].name
                        + '` and Portfolio Group => `'
                        + configFind[0].portfolioGroup.name
                        + '` and Portfolio Type => `'
                        + configFind[0].portfolioGroupType.name
                        + '` and Company => `'
                        + configFind[0].company.name + ' !',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await CompanyPortfolioModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await CompanyPortfolioModel.find({_id: id, isDeleted: false}).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new CompanyPortfolioAuditModel({
                    id: configItemDetails.id,
                    name: configItemDetails.name,
                    portfolioGroup: configItemDetails.portfolioGroup,
                    portfolioGroupType: configItemDetails.portfolioGroupType,
                    company: configItemDetails.company,
                    manager: configItemDetails.manager,
                    portfolioCurrency: configItemDetails.portfolioCurrency,
                    endOfYear: configItemDetails.endOfYear,
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

                br.sendSuccess(res, configItemDetails, 'Company Portfolio updated successfully!');

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
 * /api/v1/config/company-portfolio/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Company Portfolio]
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
                'portfolioGroup',
                'portfolioGroupType',
                'company',
                'manager',
                'portfolioCurrency',
                'endOfYear'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configCompanyPortfolioInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/company-portfolio/get-all:
 *  get:
 *      summary: Get all Company Portfolio
 *      tags: [Config-Company Portfolio]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Company Portfolio using name
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, companyPortfolioMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.name = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await CompanyPortfolioModel.find(filter).populate(['portfolioGroup', 'portfolioGroupType', 'company', 'portfolioCurrency']);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/company-portfolio/get/{id}:
 *  get:
 *      summary: get Company Portfolio details by id
 *      tags: [Config-Company Portfolio]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Company Portfolio Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, companyPortfolioMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await CompanyPortfolioModel.find({
            _id: id,
            isDeleted: false
        }).populate(['portfolioGroup', 'portfolioGroupType', 'company', 'portfolioCurrency']);

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Company Portfolio with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/company-portfolio/delete/{id}:
 *  delete:
 *      summary: delete Company Portfolio details by id
 *      tags: [Config-Company Portfolio]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Company Portfolio Id
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
router.delete("/delete/:id", authUser, companyPortfolioMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await CompanyPortfolioModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Company Portfolio with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await CompanyPortfolioModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await CompanyPortfolioModel.find({_id: id}).populate(['portfolioGroup', 'portfolioGroupType', 'company', 'portfolioCurrency']).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new CompanyPortfolioAuditModel({
            id: configItemDetails.id,
            name: configItemDetails.name,
            portfolioGroup: configItemDetails.portfolioGroup,
            portfolioGroupType: configItemDetails.portfolioGroupType,
            company: configItemDetails.company,
            manager: configItemDetails.manager,
            portfolioCurrency: configItemDetails.portfolioCurrency,
            endOfYear: configItemDetails.endOfYear,
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

        br.sendSuccess(res, configItemDetails, 'Company Portfolio deleted successfully!');
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
