const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const json2csv = require('json2csv').parse;
const { bulkUploader } = require('../helper/file_uploader');
const {processBulkInsert} = require('../helper/process_bulk_insert');
const IbAssetClassModel = require('../../../models/configIbAssetClassModel');
const IbQuoteModel = require('../../../models/configIbQuoteModel');
const IbQuoteAuditModel = require('../../../models/configIbQuoteAuditModel');
const {Validator} = require('node-input-validator');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const ibQuoteMiddleware = require('../../../middleware/config_ib_quote_middleware');

/**
 * @swagger
 * /api/v1/config/ib-quote/add:
 *  post:
 *      summary: Add Ib Quote
 *      tags: [Config-IB Quote]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          quote:
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
router.post("/add", authUser, ibQuoteMiddleware.canCreate, (req, res) => {

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
 * /api/v1/config/ib-quote/add/bulk:
 *  post:
 *      summary: Add Bulk IB Quote Type using csv file
 *      tags: [Config-IB Quote]
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
router.post("/add/bulk", authUser, ibQuoteMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Ib Quote', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {

    const v = new Validator(req.body, {
        quote: 'required|string|maxLength:30',
        assetClass: 'required|string'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            return callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    quote: inputData.quote.toString().trim(),
                    assetClass: inputData.assetClass.toString().trim()
                };

                const assetClassDetails = await IbAssetClassModel
                    .find({_id: data.assetClass, isDeleted: false,});

                if(assetClassDetails.length === 0){
                    return callback(counter, false, 'Invalid assetClass Id => ' + data.assetClass + '!');
                }

                const items = await IbQuoteModel.find({
                    quote: data.quote,
                    assetClass: data.assetClass
                }).populate('assetClass');

                if (items.length > 0) {
                    return callback(counter, false, 'Ib interest Type is already present with Quote => `'
                        + items[0].quote + '` and asset class => `'
                        + items[0].assetClass.assetClass
                        + '` with quote id '
                        + items[0].quoteId + '!', {});
                }

                await session.startTransaction();

                const ib = new IbQuoteModel({
                    quote: data.quote,
                    assetClass: data.assetClass,
                    createdByUser: req.appCurrentUserData._id
                }, {session: session});
                await ib.save();

                const auditData = new IbQuoteAuditModel({
                    quoteId: ib.quoteId,
                    assetClass: ib.assetClass,
                    quote: ib.quote,
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

                callback(counter, true, 'Ib Quote added successfully!', ib);

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
 * /api/v1/config/ib-quote/update/{id}:
 *  put:
 *      summary: Update IB Quote by id
 *      tags: [Config-IB Quote]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Quote Id
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
router.put("/update/:id", authUser, ibQuoteMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        quote: 'string|maxLength:30',
        assetClass: 'string'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItemCheck = await IbQuoteModel.find({_id: id, isDeleted: false});

                if (configItemCheck.length === 0) {
                    return br.sendNotSuccessful(res, `Ib Quote with id => ${id} not found or deleted!`);
                }
                configItemCheck = configItemCheck[0];

                let data = {};

                if (req.body.quote !== undefined) {
                    data.quote = req.body.quote.toString().trim();
                }

                if (req.body.assetClass !== undefined) {
                    data.assetClass = req.body.assetClass.toString().trim();

                    const assetClassDetails = await IbAssetClassModel
                        .find({_id: data.assetClass, isDeleted: false,});

                    if(assetClassDetails.length === 0){
                        return br.sendNotSuccessful(res, 'Invalid assetClass Id => ' + data.assetClass + '!');
                    }
                }

                let configItems = await IbQuoteModel.find({
                    _id: {
                        $nin: id
                    },
                    quote: data.quote !== undefined
                        ? data.quote
                        : configItemCheck.quote,
                    assetClass: data.assetClass !== undefined
                        ? data.assetClass
                        : configItemCheck.assetClass
                }).populate('assetClass');

                if (configItems.length > 0) {
                    return br.sendNotSuccessful(res, 'Ib Structure is already present with Quote => `'
                        + configItems[0].quote + '` and asset class => `'
                        + configItems[0].assetClass.assetClass + '` with quoteId '
                        + configItems[0].quoteId + '!', {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await IbQuoteModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await IbQuoteModel.find({_id: id, isDeleted: false})
                    .populate('assetClass').session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new IbQuoteAuditModel({
                    quoteId: configItemDetails.quoteId,
                    assetClass: configItemDetails.assetClass._id,
                    quote: configItemDetails.quote,
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

                br.sendSuccess(res, configItemDetails, 'Ib Quote updated successfully!');
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
 * /api/v1/config/ib-quote/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get IB Quote Insert sample csv file
 *      tags: [Config-IB Quote]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, ibQuoteMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([],{
            fields: [
                'quote',
                'assetClass'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configIbQuoteInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});


/**
 * @swagger
 * /api/v1/config/ib-quote/get-all:
 *  get:
 *      summary: Get all IB Quote
 *      tags: [Config-IB Quote]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search ib quote using quote
 *        default: fixed
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, ibQuoteMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.quote = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await IbQuoteModel.find(filter).populate('assetClass');
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-quote/get/{id}:
 *  get:
 *      summary: get IB Quote details by id
 *      tags: [Config-IB Quote]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Quote Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, ibQuoteMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let configDetails = await IbQuoteModel.find({_id: id, isDeleted: false}).populate('assetClass');

        if (configDetails.length === 0) {
            return br.sendNotSuccessful(res, `IB Quote with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, configDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-quote/delete/{id}:
 *  delete:
 *      summary: delete IB Quote details by id
 *      tags: [Config-IB Quote]
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
router.delete("/delete/:id", authUser, ibQuoteMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await IbQuoteModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Quote with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await IbQuoteModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await IbQuoteModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new IbQuoteAuditModel({
            quoteId: configItemDetails.quoteId,
            assetClass: configItemDetails.assetClass._id,
            quote: configItemDetails.quote,
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

        br.sendSuccess(res, configItemDetails, 'Ib Quote deleted successfully!');
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
