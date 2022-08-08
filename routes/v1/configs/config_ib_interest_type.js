const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const json2csv = require('json2csv').parse;
const { bulkUploader } = require('../helper/file_uploader');
const IbAssetClassModel = require('../../../models/configIbAssetClassModel');
const IbInterestTypeModel = require('../../../models/configIbInterestTypeModel');
const IbInterestTypeAuditModel = require('../../../models/configIbInterestTypeAuditModel');
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {Validator} = require('node-input-validator');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const ibInterestTypeMiddleware = require('../../../middleware/config_ib_interest_type_middleware');

/**
 * @swagger
 * /api/v1/config/ib-interest-type/add:
 *  post:
 *      summary: Add Ib Interest Type
 *      tags: [Config-IB Interest Type]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          interestTypeName:
 *                              type: string
 *                              default: Fixed
 *                          assetClass:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, ibInterestTypeMiddleware.canCreate, (req, res) => {

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
 * /api/v1/config/ib-interest-type/add/bulk:
 *  post:
 *      summary: Add Bulk IB Interest Type using csv file
 *      tags: [Config-IB Interest Type]
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
router.post("/add/bulk", authUser, ibInterestTypeMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Ib Interest', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {

    const v = new Validator(req.body, {
        interestTypeName: 'required|string|maxLength:30',
        assetClass: 'required|string'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            return callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    interestTypeName: inputData.interestTypeName.toString().trim(),
                    assetClass: inputData.assetClass.toString().trim()
                };

                const assetClassDetails = await IbAssetClassModel
                    .find({_id: data.assetClass, isDeleted: false,});

                if(assetClassDetails.length === 0){
                    return callback(counter, false, 'Invalid assetClass Id => ' + data.assetClass + '!');
                }

                const items = await IbInterestTypeModel.find({
                    interestTypeName: data.interestTypeName,
                    assetClass: data.assetClass
                }).populate('assetClass');

                if (items.length > 0) {
                    return callback(counter, false, 'Ib Interest Type is already present with Interest Type Name => `'
                        + items[0].interestTypeName + '` and asset class => `'
                        + items[0].assetClass.assetClass
                        + '` with structure id '
                        + items[0].structureId + '!', {});
                }

                await session.startTransaction();

                const ib = new IbInterestTypeModel({
                    interestTypeName: data.interestTypeName,
                    assetClass: data.assetClass,
                    createdByUser: req.appCurrentUserData._id
                }, {session: session});
                await ib.save();

                const auditData = new IbInterestTypeAuditModel({
                    interestTypeId: ib.interestTypeId,
                    assetClass: ib.assetClass,
                    interestTypeName: ib.interestTypeName,
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

                callback(counter, true, 'Ib Interest Type added successfully!', ib);

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
 * /api/v1/config/ib-interest-type/update/{id}:
 *  put:
 *      summary: Update IB Interest Type by id
 *      tags: [Config-IB Interest Type]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Interest Type Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          interestTypeName:
 *                              type: string
 *                              default: Fixed
 *                          assetClass:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, ibInterestTypeMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        interestTypeName: 'string|maxLength:30',
        assetClass: 'string'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItemCheck = await IbInterestTypeModel.find({_id: id, isDeleted: false});

                if (configItemCheck.length === 0) {
                    return br.sendNotSuccessful(res, `Ib Interest Type with id => ${id} not found or deleted!`);
                }
                configItemCheck = configItemCheck[0];

                let data = {};

                if (req.body.interestTypeName !== undefined) {
                    data.interestTypeName = req.body.interestTypeName.toString().trim();
                }

                if (req.body.assetClass !== undefined) {
                    data.assetClass = req.body.assetClass.toString().trim();

                    const assetClassDetails = await IbAssetClassModel
                        .find({_id: data.assetClass, isDeleted: false,});

                    if(assetClassDetails.length === 0){
                        return br.sendNotSuccessful(res, 'Invalid assetClass Id => ' + data.assetClass + '!');
                    }
                }

                let configItems = await IbInterestTypeModel.find({
                    _id: {
                        $nin: id
                    },
                    interestTypeName: data.interestTypeName !== undefined
                        ? data.interestTypeName
                        : configItemCheck.interestTypeName,
                    assetClass: data.assetClass !== undefined
                        ? data.assetClass
                        : configItemCheck.assetClass
                }).populate('assetClass');

                if (configItems.length > 0) {
                    return br.sendNotSuccessful(res, 'Ib Interest Type is already present with Interest Type Name => `'
                        + configItems[0].interestTypeName + '` and asset class => `'
                        + configItems[0].assetClass.assetClass + '` with interestTypeId '
                        + configItems[0].interestTypeId + '!', {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await IbInterestTypeModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await IbInterestTypeModel.find({_id: id, isDeleted: false})
                    .populate('assetClass').session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new IbInterestTypeAuditModel({
                    interestTypeId: configItemDetails.interestTypeId,
                    assetClass: configItemDetails.assetClass._id,
                    interestTypeName: configItemDetails.interestTypeName,
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

                br.sendSuccess(res, configItemDetails, 'Ib Interest Type updated successfully!');
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
 * /api/v1/config/ib-interest-type/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get IB Interest Type Insert sample csv file
 *      tags: [Config-IB Interest Type]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, ibInterestTypeMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([],{
            fields: [
                'interestTypeName',
                'assetClass'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configIbInterestTypeInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-interest-type/get-all:
 *  get:
 *      summary: Get all IB Interest Type
 *      tags: [Config-IB Interest Type]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search ib interest type using interestTypeName
 *        default: fixed
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, ibInterestTypeMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.interestTypeName = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await IbInterestTypeModel.find(filter).populate('assetClass');
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-interest-type/get/{id}:
 *  get:
 *      summary: get IB Interest Type details by id
 *      tags: [Config-IB Interest Type]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Structure Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, ibInterestTypeMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let configDetails = await IbInterestTypeModel.find({_id: id, isDeleted: false}).populate('assetClass');

        if (configDetails.length === 0) {
            return br.sendNotSuccessful(res, `InterestType with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, configDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-interest-type/delete/{id}:
 *  delete:
 *      summary: delete IB Interest Type details by id
 *      tags: [Config-IB Interest Type]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Structure Id
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
router.delete("/delete/:id", authUser, ibInterestTypeMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await IbInterestTypeModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `InterestType with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await IbInterestTypeModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await IbInterestTypeModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new IbInterestTypeAuditModel({
            interestTypeId: configItemDetails.interestTypeId,
            assetClass: configItemDetails.assetClass._id,
            interestTypeName: configItemDetails.interestTypeName,
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

        br.sendSuccess(res, configItemDetails, 'Ib Interest Type deleted successfully!');
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
