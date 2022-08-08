const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const json2csv = require('json2csv').parse;
const { bulkUploader } = require('../helper/file_uploader');
const {processBulkInsert} = require('../helper/process_bulk_insert');
const PortfolioTypeModel = require('../../../models/configPortfolioTypeModel');
const PortfolioTypeAuditModel = require('../../../models/configPortfolioTypeAuditModel');
const {Validator} = require('node-input-validator');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const portfolioTypeMiddleware = require('../../../middleware/config_portfolio_type_middleware');

/**
 * @swagger
 * /api/v1/config/portfolio-type/add:
 *  post:
 *      summary: Add Portfolio Type
 *      tags: [Config-Portfolio Type]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          portfolioGroupType:
 *                              type: string
 *                              default: Group Type
 *                          portfolioType:
 *                              type: string
 *                              default: Type
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, portfolioTypeMiddleware.canCreate, (req, res) => {

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
 * /api/v1/config/portfolio-type/add/bulk:
 *  post:
 *      summary: Add Bulk Portfolio Type Type using csv file
 *      tags: [Config-Portfolio Type]
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
router.post("/add/bulk", authUser, portfolioTypeMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Portfolio Type', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(req.body, {
        portfolioGroupType: 'required|string',
        portfolioType: 'required|string'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            return callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    portfolioGroupType: req.body.portfolioGroupType.toString().trim(),
                    portfolioType: req.body.portfolioType.toString().trim()
                };

                const items = await PortfolioTypeModel.find({
                    portfolioGroupType: data.portfolioGroupType,
                    portfolioType: data.portfolioType
                });

                if (items.length > 0) {
                    return callback(counter, false, 'Portfolio Type is already present with Portfolio Type Name => `'
                        + items[0].portfolioGroupType + '` and Portfolio Type => `'
                        + items[0].portfolioType + '` with Portfolio Type Id '
                        + items[0].portfolioTypeId + '!', {});
                }

                await session.startTransaction();

                const ib = new PortfolioTypeModel({
                    portfolioGroupType: data.portfolioGroupType,
                    portfolioType: data.portfolioType,
                    createdByUser: req.appCurrentUserData._id
                }, {session: session});
                await ib.save();

                const auditData = new PortfolioTypeAuditModel({
                    portfolioTypeId: ib.portfolioTypeId,
                    portfolioGroupType: ib.portfolioGroupType,
                    portfolioType: ib.portfolioType,
                    changedByUser: ib.changedByUser,
                    changedDate: ib.changedDate,
                    createdByUser: ib.createdByUser,
                    isDeleted: ib.isDeleted,
                    deletedBy: ib.deletedBy,
                    deleteReason: ib.deleteReason,
                    actionItemId: ib._id,
                    action: helper.sysConst.permissionAccessTypes.CREATE,
                    actionDate: new Date(),
                    actionBy: req.appCurrentUserData._id
                }, {session: session});
                await auditData.save();

                await session.commitTransaction();

                callback(counter, true, 'Portfolio Type added successfully!', ib);
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
 * /api/v1/config/portfolio-type/update/{id}:
 *  put:
 *      summary: Update Portfolio Type by id
 *      tags: [Config-Portfolio Type]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Portfolio Type Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          portfolioGroupType:
 *                              type: string
 *                              default: Group Type
 *                          portfolioType:
 *                              type: string
 *                              default: Type
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, portfolioTypeMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        portfolioGroupType: 'string',
        portfolioType: 'string'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let portfolioType = await PortfolioTypeModel.find({_id: id, isDeleted: false});

                if (portfolioType.length === 0) {
                    return br.sendNotSuccessful(res, `Portfolio type with id => ${id} not found or deleted!`);
                }

                portfolioType = portfolioType[0];

                let data = {};

                if (req.body.portfolioGroupType !== undefined) {
                    data.portfolioGroupType = req.body.portfolioGroupType.toString().trim();
                }

                if (req.body.portfolioType !== undefined) {
                    data.portfolioType = req.body.portfolioType.toString().trim();
                }

                let portFolioTypes = await PortfolioTypeModel.find({
                    _id: {
                        $nin: id
                    },
                    portfolioGroupType: data.portfolioGroupType !== undefined
                        ? data.portfolioGroupType
                        : portfolioType.portfolioGroupType,
                    portfolioType: data.portfolioType !== undefined
                        ? data.portfolioType
                        : portfolioType.portfolioType
                });

                if (portFolioTypes.length > 0) {
                    return br.sendNotSuccessful(res, 'Portfolio Type is already present with Portfolio Type Name => `'
                        + portFolioTypes[0].portfolioGroupType + '` and Portfolio Type => `'
                        + portFolioTypes[0].portfolioType + '` with Portfolio Type Id '
                        + portFolioTypes[0].portfolioTypeId + '!', {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await PortfolioTypeModel.updateOne({_id: id}, data).session(session);

                let ptDetails = await PortfolioTypeModel.find({_id: id, isDeleted: false}).session(session);
                ptDetails = ptDetails[0];

                const auditData = new PortfolioTypeAuditModel({
                    portfolioTypeId: ptDetails.portfolioTypeId,
                    portfolioGroupType: ptDetails.portfolioGroupType,
                    portfolioType: ptDetails.portfolioType,
                    changedByUser: ptDetails.changedByUser,
                    changedDate: ptDetails.changedDate,
                    createdByUser: ptDetails.createdByUser,
                    isDeleted: ptDetails.isDeleted,
                    deletedBy: ptDetails.deletedBy,
                    deleteReason: ptDetails.deleteReason,
                    actionItemId: ptDetails._id,
                    action: helper.sysConst.permissionAccessTypes.EDIT,
                    actionDate: new Date(),
                    actionBy: ptDetails.createdByUser,
                }, {session: session});
                await auditData.save();

                await session.commitTransaction();

                br.sendSuccess(res, ptDetails, 'Portfolio Type updated successfully!');
                //res.send([req.appCurrentUserData, req.appCurrentUserPermissions]);
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
 * /api/v1/config/portfolio-type/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get Portfolio Type Insert sample csv file
 *      tags: [Config-Portfolio Type]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, portfolioTypeMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([],{
            fields: [
                'portfolioGroupType',
                'portfolioType'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configPortfolioTypeInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/portfolio-type/get-all:
 *  get:
 *      summary: Get all Portfolio Type
 *      tags: [Config-Portfolio Type]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search portfolio type using portfolio type Name
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, portfolioTypeMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.portfolioType = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await PortfolioTypeModel.find(filter);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/portfolio-type/get/{id}:
 *  get:
 *      summary: get Portfolio Type details by id
 *      tags: [Config-Portfolio Type]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Portfolio Type Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, portfolioTypeMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await PortfolioTypeModel.find({_id: id, isDeleted: false});

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Portfolio Type with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/portfolio-type/delete/{id}:
 *  delete:
 *      summary: delete Portfolio Type details by id
 *      tags: [Config-Portfolio Type]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Portfolio Type Id
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
router.delete("/delete/:id", authUser, portfolioTypeMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let portfolioTypeDetails = await PortfolioTypeModel.find({_id: id, isDeleted: false});

        if (portfolioTypeDetails.length === 0) {
            return br.sendNotSuccessful(res, `Portfolio Type with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await PortfolioTypeModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        portfolioTypeDetails = await PortfolioTypeModel.find({_id: id}).session(session);
        portfolioTypeDetails = portfolioTypeDetails[0];

        const auditData = new PortfolioTypeAuditModel({
            portfolioTypeId: portfolioTypeDetails.portfolioTypeId,
            portfolioGroupType: portfolioTypeDetails.portfolioGroupType,
            portfolioType: portfolioTypeDetails.portfolioType,
            changedByUser: portfolioTypeDetails.changedByUser,
            changedDate: portfolioTypeDetails.changedDate,
            createdByUser: portfolioTypeDetails.createdByUser,
            isDeleted: portfolioTypeDetails.isDeleted,
            deletedBy: portfolioTypeDetails.deletedBy,
            deleteReason: portfolioTypeDetails.deleteReason,
            actionItemId: portfolioTypeDetails._id,
            action: helper.sysConst.permissionAccessTypes.DELETE,
            actionDate: new Date(),
            actionBy: portfolioTypeDetails.createdByUser,
        }, {session: session});
        await auditData.save();

        await session.commitTransaction();

        br.sendSuccess(res, portfolioTypeDetails, 'Ib Structure deleted successfully!');
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
