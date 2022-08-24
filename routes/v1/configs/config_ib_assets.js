const express = require("express");
const mongo = require("mongoose");
const router = new express.Router();
const json2csv = require('json2csv').parse;
const helper = require("../../../helper/helper");
const br = helper.baseResponse;
const { bulkUploader } = require('../helper/file_uploader');
const IbAssetClassModel = require('../../../models/configIbAssetClassModel');
const IbAssetClassAuditModel = require('../../../models/configIbAssetClassAuditModel');
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {Validator} = require('node-input-validator');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const ibAssetMiddleware = require('../../../middleware/config_ib_assets_middleware');

/**
 * @swagger
 * /api/v1/config/ib-assets/add:
 *  post:
 *      summary: Add Ib Asset
 *      tags: [Config-IB Assets]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          class:
 *                              type: string
 *                              default: BOND
 *                          description:
 *                              type: string
 *                              default: BOND
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, ibAssetMiddleware.canCreate, (req, res) => {

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
 * /api/v1/config/ib-assets/add/bulk:
 *  post:
 *      summary: Add Bulk IB Assets using csv file
 *      tags: [Config-IB Assets]
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
router.post("/add/bulk", authUser, ibAssetMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Ib Asset', insertData);
});


function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        class: 'required|string|maxLength:30',
        description: 'required|string|maxLength:30'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            return callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    assetClass: inputData.class.toString().trim(),
                    assetClassDescription: inputData.description.toString().trim()
                };

                const assets = await IbAssetClassModel.find({assetClass: data.assetClass});

                if (assets.length > 0) {
                    return callback(counter, false, 'assetClass `'
                        + data.assetClass
                        + '` is already present in the database!', {});
                }

                await session.startTransaction();

                const ib = new IbAssetClassModel({
                    assetClass: data.assetClass,
                    assetClassDescription: data.assetClassDescription,
                    createdByUser: req.appCurrentUserData._id
                }, {session: session});
                await ib.save();

                const auditData = new IbAssetClassAuditModel({
                    assetClass: ib.assetClass,
                    assetClassDescription: ib.assetClassDescription,
                    changedByUser: ib.changedByUser,
                    changedDate: ib.changedDate,
                    createdByUser: ib.createdByUser,
                    actionItemId: ib._id,
                    action: helper.sysConst.permissionAccessTypes.CREATE,
                    actionDate: new Date(),
                    actionBy: req.appCurrentUserData._id,
                }, {session: session});
                await auditData.save();

                await session.commitTransaction();

                callback(counter, true, 'Ib Asset Class added successfully!', ib);

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
 * /api/v1/config/ib-assets/update/{id}:
 *  put:
 *      summary: Update Ib Asset by id
 *      tags: [Config-IB Assets]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Asset Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          class:
 *                              type: string
 *                              default: BOND
 *                          description:
 *                              type: string
 *                              default: BOND
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, ibAssetMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        class: 'string|maxLength:30',
        description: 'string|maxLength:30'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let asset = await IbAssetClassModel.find({_id: id, isDeleted: false});

                if (asset.length === 0) {
                    return br.sendNotSuccessful(res, `Asset class with id => ${id} not found or deleted!`);
                }

                let data = {};

                if (req.body.class !== undefined) {
                    data.assetClass = req.body.class.toString().trim();
                }

                if (req.body.description !== undefined) {
                    data.assetClassDescription = req.body.description.toString().trim();
                }

                let assets = await IbAssetClassModel.find({
                    _id: {
                        $nin: id
                    },
                    assetClass: data.assetClass
                });

                if (assets.length > 0) {
                    return br.sendNotSuccessful(res, 'assetClass `'
                        + data.assetClass
                        + '` is already present in the database!', {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await IbAssetClassModel.updateOne({_id: id}, data).session(session);

                let assetDetails = await IbAssetClassModel.find({_id: id, isDeleted: false}).session(session);
                assetDetails = assetDetails[0];

                const auditData = new IbAssetClassAuditModel({
                    assetClass: assetDetails.assetClass,
                    assetClassDescription: assetDetails.assetClassDescription,
                    changedByUser: assetDetails.changedByUser,
                    changedDate: assetDetails.changedDate,
                    createdByUser: assetDetails.createdByUser,
                    actionItemId: assetDetails._id,
                    action: helper.sysConst.permissionAccessTypes.EDIT,
                    actionDate: new Date(),
                    actionBy: req.appCurrentUserData._id,
                }, {session: session});
                await auditData.save();

                await session.commitTransaction();

                br.sendSuccess(res, assetDetails, 'Ib Asset Class updated successfully!');
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
 * /api/v1/config/ib-assets/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get Ib Asset Insert sample csv file
 *      tags: [Config-IB Assets]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, ibAssetMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'class',
                'description'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configIbAssetBulkInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-assets/get-all:
 *  get:
 *      summary: Get all asset class
 *      tags: [Config-IB Assets]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search asset using assetClass Name
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, ibAssetMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.assetClass = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await IbAssetClassModel.find(filter);
        br.sendSuccess(res, assets);
    } catch (error) {
        br.sendServerError(res, error);
    }
});

/**
 * @swagger
 * /api/v1/config/ib-assets/get/{id}:
 *  get:
 *      summary: get asset class details by id
 *      tags: [Config-IB Assets]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Asset Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, ibAssetMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await IbAssetClassModel.find({_id: id, isDeleted: false});

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Asset class with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        br.sendServerError(res, error);
    }
});

/**
 * @swagger
 * /api/v1/config/ib-assets/delete/{id}:
 *  delete:
 *      summary: delete asset class details by id
 *      tags: [Config-IB Assets]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Asset Id
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
router.delete("/delete/:id", authUser, ibAssetMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let assetDetails = await IbAssetClassModel.find({_id: id, isDeleted: false});

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Asset class with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await IbAssetClassModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        assetDetails = await IbAssetClassModel.find({_id: id}).session(session);
        assetDetails = assetDetails[0];

        const auditData = new IbAssetClassAuditModel({
            assetClass: assetDetails.assetClass,
            assetClassDescription: assetDetails.assetClassDescription,
            changedByUser: assetDetails.changedByUser,
            changedDate: assetDetails.changedDate,
            createdByUser: assetDetails.createdByUser,
            isDeleted: assetDetails.isDeleted,
            deletedBy: assetDetails.deletedBy,
            deleteReason: assetDetails.deleteReason,
            actionItemId: assetDetails._id,
            action: helper.sysConst.permissionAccessTypes.DELETE,
            actionDate: new Date(),
            actionBy: req.appCurrentUserData._id,
        }, {session: session});
        await auditData.save();

        await session.commitTransaction();

        br.sendSuccess(res, {}, 'Ib Asset details deleted');
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        br.sendServerError(res, error);

    } finally {
        await session.endSession();
    }
});

module.exports = router;
