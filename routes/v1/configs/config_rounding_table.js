const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const json2csv = require('json2csv').parse;
const { bulkUploader } = require('../helper/file_uploader');
const {processBulkInsert} = require('../helper/process_bulk_insert');
const RoundingTableModel = require('../../../models/configRoundingTableModel');
const RoundingTableAuditModel = require('../../../models/configRoundingTableAuditModel');
const {Validator} = require('node-input-validator');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const roundingTableMiddleware = require('../../../middleware/config_rounding_table_middleware');

/**
 * @swagger
 * /api/v1/config/rounding-table/add:
 *  post:
 *      summary: Add Rounding Table
 *      tags: [Config-Rounding Table]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          id:
 *                              type: string
 *                              default: qwfqwf
 *                          name:
 *                              type: string
 *                              default: wqfqwf
 *                          instrumentType:
 *                              type: string
 *                              default: asfwf
 *                          fieldToBeRounded:
 *                              type: string
 *                              default: afaw
 *                          roundingValue:
 *                              type: string
 *                              default: dfqewf
 *                          roundingType:
 *                              type: string
 *                              default: awfaw
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, roundingTableMiddleware.canCreate, (req, res) => {

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
 * /api/v1/config/rounding-table/add/bulk:
 *  post:
 *      summary: Add Bulk Rounding Table Type using csv file
 *      tags: [Config-Rounding Table]
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
router.post("/add/bulk", authUser, roundingTableMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Rounding Table', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {

    const v = new Validator(inputData, {
        id: 'required|string',
        name: 'required|string',
        instrumentType: 'required|string',
        fieldToBeRounded: 'required|string',
        roundingValue: 'required|string',
        roundingType: 'required|string'
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
                    instrumentType: inputData.instrumentType.toString().trim(),
                    fieldToBeRounded: inputData.fieldToBeRounded.toString().trim(),
                    roundingValue: inputData.roundingValue.toString().trim(),
                    roundingType: inputData.roundingType.toString().trim()
                };

                const configFind = await RoundingTableModel.find({
                    id: data.id,
                    name: data.name,
                    fieldToBeRounded: data.fieldToBeRounded
                });

                if (configFind.length > 0) {
                    return callback(counter, false, 'Rounding Table is already '
                        + 'present with id => `'
                        + configFind[0].id
                        + '` and Name => `'
                        + configFind[0].name
                        + '` and fieldToBeRounded => `'
                        + configFind[0].fieldToBeRounded + '!',
                        {});
                }

                await session.startTransaction();

                const ib = new RoundingTableModel({
                    id: data.id,
                    name: data.name,
                    instrumentType: data.instrumentType,
                    fieldToBeRounded: data.fieldToBeRounded,
                    roundingValue: data.roundingValue,
                    roundingType: data.roundingType,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new RoundingTableAuditModel({
                    id: ib.id,
                    name: ib.name,
                    instrumentType: ib.instrumentType,
                    fieldToBeRounded: ib.fieldToBeRounded,
                    roundingValue: ib.roundingValue,
                    roundingType: ib.roundingType,
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

                callback(counter, true, 'Rounding Table added successfully!', ib);

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
 * /api/v1/config/rounding-table/update/{id}:
 *  put:
 *      summary: Update Rounding Table by id
 *      tags: [Config-Rounding Table]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Rounding Table Id
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
 *                              default: qwfqwf
 *                          name:
 *                              type: string
 *                              default: wqfqwf
 *                          instrumentType:
 *                              type: string
 *                              default: asfwf
 *                          fieldToBeRounded:
 *                              type: string
 *                              default: afaw
 *                          roundingValue:
 *                              type: string
 *                              default: dfqewf
 *                          roundingType:
 *                              type: string
 *                              default: awfaw
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, roundingTableMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        id: 'string',
        name: 'string',
        instrumentType: 'string',
        fieldToBeRounded: 'string',
        roundingValue: 'string',
        roundingType: 'string',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await RoundingTableModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Rounding Table with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.id !== undefined) {
                    data.id = req.body.id.toString().trim();
                }

                if (req.body.name !== undefined) {
                    data.name = req.body.name.toString().trim();
                }

                if (req.body.instrumentType !== undefined) {
                    data.instrumentType = req.body.instrumentType.toString().trim();
                }

                if (req.body.fieldToBeRounded !== undefined) {
                    data.fieldToBeRounded = req.body.fieldToBeRounded.toString().trim();
                }

                if (req.body.instrumentType !== undefined) {
                    data.instrumentType = req.body.instrumentType.toString().trim();
                }

                if (req.body.roundingValue !== undefined) {
                    data.roundingValue = req.body.roundingValue.toString().trim();
                }

                if (req.body.roundingType !== undefined) {
                    data.roundingType = req.body.roundingType.toString().trim();
                }

                let configFind = await RoundingTableModel.find({
                    _id: {
                        $nin: id
                    },
                    id: data.id !== undefined
                        ? data.id
                        : configItem.id,
                    name: data.name !== undefined
                        ? data.name
                        : configItem.name,
                    fieldToBeRounded: data.fieldToBeRounded !== undefined
                        ? data.fieldToBeRounded
                        : configItem.fieldToBeRounded
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Rounding Table is already '
                        + 'present with id => `'
                        + configFind[0].id
                        + '` and Name => `'
                        + configFind[0].name
                        + '` and fieldToBeRounded => `'
                        + configFind[0].fieldToBeRounded + '!',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await RoundingTableModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await RoundingTableModel.find({_id: id, isDeleted: false}).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new RoundingTableAuditModel({
                    id: configItemDetails.id,
                    name: configItemDetails.name,
                    instrumentType: configItemDetails.instrumentType,
                    fieldToBeRounded: configItemDetails.fieldToBeRounded,
                    roundingValue: configItemDetails.roundingValue,
                    roundingType: configItemDetails.roundingType,
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

                br.sendSuccess(res, configItemDetails, 'Rounding Table updated successfully!');

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
 * /api/v1/config/rounding-table/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get Rounding Table Insert sample csv file
 *      tags: [Config-Rounding Table]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, roundingTableMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'id',
                'name',
                'instrumentType',
                'fieldToBeRounded',
                'roundingValue',
                'roundingType'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configRoundingTableSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/rounding-table/get-all:
 *  get:
 *      summary: Get all Rounding Table
 *      tags: [Config-Rounding Table]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Rounding Table using name
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, roundingTableMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.name = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await RoundingTableModel.find(filter);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/rounding-table/get/{id}:
 *  get:
 *      summary: get Rounding Table details by id
 *      tags: [Config-Rounding Table]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Rounding Table Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, roundingTableMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let currencyDetails = await RoundingTableModel.find({_id: id, isDeleted: false});

        if (currencyDetails.length === 0) {
            return br.sendNotSuccessful(res, `Rounding Table with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, currencyDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/rounding-table/delete/{id}:
 *  delete:
 *      summary: delete Rounding Table details by id
 *      tags: [Config-Rounding Table]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Rounding Table Id
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
router.delete("/delete/:id", authUser, roundingTableMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await RoundingTableModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Rounding Table with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await RoundingTableModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await RoundingTableModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new RoundingTableAuditModel({
            id: configItemDetails.id,
            name: configItemDetails.name,
            instrumentType: configItemDetails.instrumentType,
            fieldToBeRounded: configItemDetails.fieldToBeRounded,
            roundingValue: configItemDetails.roundingValue,
            roundingType: configItemDetails.roundingType,
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

        br.sendSuccess(res, configItemDetails, 'Rounding Table deleted successfully!');
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
