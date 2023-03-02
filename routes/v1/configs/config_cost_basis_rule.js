const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const json2csv = require('json2csv').parse;
const { bulkUploader } = require('../helper/file_uploader');
const {processBulkInsert} = require('../helper/process_bulk_insert');
const costBasisRuleModel = require('../../../models/configCostBasisRuleModel');
const costBasisRuleAuditModel = require('../../../models/configCostBasisRuleAuditModel');
const {Validator} = require('node-input-validator');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const costBasisRuleMiddleware = require('../../../middleware/config_cost_basis_rule_middleware');

/**
 * @swagger
 * /api/v1/config/cost-basis-rule/add:
 *  post:
 *      summary: Add Cost Basis Rule
 *      tags: [Config-Cost Basis Rule]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          costBasisProfileId:
 *                              type: string
 *                              default: GAAP Pools
 *                          costBasisProfileName:
 *                              type: string
 *                              default: GAAP Pool Rules
 *                          cbaRuleId:
 *                              type: string
 *                              default: HEDGE_CBA
 *                          cbaRuleName:
 *                              type: string
 *                              default: Hedge Dedes
 *                          cbaRuleType:
 *                              type: string
 *                              default: User-Specified CBA
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, costBasisRuleMiddleware.canCreate, (req, res) => {

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
 * /api/v1/config/cost-basis-rule/add/bulk:
 *  post:
 *      summary: Add Bulk Cost Basis Rule Type using csv file
 *      tags: [Config-Cost Basis Rule]
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
router.post("/add/bulk", authUser, costBasisRuleMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Cost Basis Rule', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {

    const v = new Validator(req.body, {
        costBasisProfileId: 'required|string|maxLength:30',
        costBasisProfileName: 'required|string|maxLength:30',
        cbaRuleId: 'required|string|maxLength:30',
        cbaRuleName: 'required|string|maxLength:30',
        cbaRuleType: 'required|string|maxLength:30'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    costBasisProfileId: inputData.costBasisProfileId.toString().trim(),
                    costBasisProfileName: inputData.costBasisProfileName.toString().trim(),
                    cbaRuleId: inputData.cbaRuleId.toString().trim(),
                    cbaRuleName: inputData.cbaRuleName.toString().trim(),
                    cbaRuleType: inputData.cbaRuleType.toString().trim(),
                };

                const configFind = await costBasisRuleModel.find({
                    costBasisProfileId: data.costBasisProfileId,
                    costBasisProfileName: data.costBasisProfileName,
                    cbaRuleId: data.cbaRuleId,
                    cbaRuleName: data.cbaRuleName,
                    cbaRuleType: data.cbaRuleType,
                });

                if (configFind.length > 0) {
                    return callback(counter, false, 'Cost Basis Rule is already '
                        + 'present with Cost Basis Profile Id => `'
                        + configFind[0].costBasisProfileId
                        + '` and Cost Basis Profile Name => `'
                        + configFind[0].costBasisProfileName
                        + '` and CBA Rule Id => `'
                        + configFind[0].cbaRuleId
                        + '` and CBA Rule Name => `'
                        + configFind[0].cbaRuleName
                        + '` and CBA Rule Type => `'
                        + configFind[0].cbaRuleType + '!',
                        {});
                }

                await session.startTransaction();

                const ib = new costBasisRuleModel({
                    costBasisProfileId: data.costBasisProfileId,
                    costBasisProfileName: data.costBasisProfileName,
                    cbaRuleId: data.cbaRuleId,
                    cbaRuleName: data.cbaRuleName,
                    cbaRuleType: data.cbaRuleType,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new costBasisRuleAuditModel({
                    costBasisProfileId: ib.costBasisProfileId,
                    costBasisProfileName: ib.costBasisProfileName,
                    cbaRuleId: ib.cbaRuleId,
                    cbaRuleName: ib.cbaRuleName,
                    cbaRuleType: ib.cbaRuleType,
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

                callback(counter, false, 'Cost Basis Rule added successfully!', ib);

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
 * /api/v1/config/cost-basis-rule/update/{id}:
 *  put:
 *      summary: Update Cost Basis Rule by id
 *      tags: [Config-Cost Basis Rule]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Cost Basis Rule Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          costBasisProfileId:
 *                              type: string
 *                              default: GAAP Pools
 *                          costBasisProfileName:
 *                              type: string
 *                              default: GAAP Pool Rules
 *                          cbaRuleId:
 *                              type: string
 *                              default: HEDGE_CBA
 *                          cbaRuleName:
 *                              type: string
 *                              default: Hedge Dedes
 *                          cbaRuleType:
 *                              type: string
 *                              default: User-Specified CBA
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, costBasisRuleMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        costBasisProfileId: 'string|maxLength:30',
        costBasisProfileName: 'string|maxLength:30',
        cbaRuleId: 'string|maxLength:30',
        cbaRuleName: 'string|maxLength:30',
        cbaRuleType: 'string|maxLength:30'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await costBasisRuleModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Cost Basis Rule with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.costBasisProfileId !== undefined) {
                    data.costBasisProfileId = req.body.costBasisProfileId.toString().trim();
                }

                if (req.body.costBasisProfileName !== undefined) {
                    data.costBasisProfileName = req.body.costBasisProfileName.toString().trim();
                }

                if (req.body.cbaRuleId !== undefined) {
                    data.cbaRuleId = req.body.cbaRuleId.toString().trim();
                }

                if (req.body.cbaRuleName !== undefined) {
                    data.cbaRuleName = req.body.cbaRuleName.toString().trim();
                }

                if (req.body.cbaRuleType !== undefined) {
                    data.cbaRuleType = req.body.cbaRuleType.toString().trim();
                }

                let configFind = await costBasisRuleModel.find({
                    _id: {
                        $nin: id
                    },
                    costBasisProfileId: data.costBasisProfileId !== undefined
                        ? data.costBasisProfileId
                        : configItem.costBasisProfileId,
                    costBasisProfileName: data.costBasisProfileName !== undefined
                        ? data.costBasisProfileName
                        : configItem.costBasisProfileName,
                    cbaRuleId: data.cbaRuleId !== undefined
                        ? data.cbaRuleId
                        : configItem.cbaRuleId,
                    cbaRuleName: data.cbaRuleName !== undefined
                        ? data.cbaRuleName
                        : configItem.cbaRuleName,
                    cbaRuleType: data.cbaRuleType !== undefined
                        ? data.cbaRuleType
                        : configItem.cbaRuleType
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Cost Basis Rule is already '
                        + 'present with Cost Basis Profile Id => `'
                        + configFind[0].costBasisProfileId
                        + '` and Cost Basis Profile Name => `'
                        + configFind[0].costBasisProfileName
                        + '` and CBA Rule Id => `'
                        + configFind[0].cbaRuleId
                        + '` and CBA Rule Name => `'
                        + configFind[0].cbaRuleName
                        + '` and CBA Rule Type => `'
                        + configFind[0].cbaRuleType + '!',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await costBasisRuleModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await costBasisRuleModel.find({_id: id, isDeleted: false}).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new costBasisRuleAuditModel({
                    costBasisProfileId: configItemDetails.costBasisProfileId,
                    costBasisProfileName: configItemDetails.costBasisProfileName,
                    cbaRuleId: configItemDetails.cbaRuleId,
                    cbaRuleName: configItemDetails.cbaRuleName,
                    cbaRuleType: configItemDetails.cbaRuleType,
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

                br.sendSuccess(res, configItemDetails, 'Cost Basis Rule updated successfully!');

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
 * /api/v1/config/cost-basis-rule/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get Cost Basis Rule Insert sample csv file
 *      tags: [Config-Cost Basis Rule]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, costBasisRuleMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([],{
            fields: [
                'costBasisProfileId',
                'costBasisProfileName',
                'cbaRuleId',
                'cbaRuleName',
                'cbaRuleType'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configCostBasisRuleSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/cost-basis-rule/get-all:
 *  get:
 *      summary: Get all Cost Basis Rule
 *      tags: [Config-Cost Basis Rule]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Cost Basis Rules using costBasisProfileName
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, costBasisRuleMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.costBasisProfileName = {
                $regex: new RegExp('^' + req.query.search, 'i'),
            }
        }

        let assets = await costBasisRuleModel.find(filter);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/cost-basis-rule/get/{id}:
 *  get:
 *      summary: get Cost Basis Rule details by id
 *      tags: [Config-Cost Basis Rule]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Cost Basis Rule Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, costBasisRuleMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await costBasisRuleModel.find({_id: id, isDeleted: false});

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Cost Basis Rule with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/cost-basis-rule/delete/{id}:
 *  delete:
 *      summary: delete Cost Basis Rule details by id
 *      tags: [Config-Cost Basis Rule]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Cost Basis Rule Id
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
router.delete("/delete/:id", authUser, costBasisRuleMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await costBasisRuleModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Cost Basis Rule with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await costBasisRuleModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await costBasisRuleModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new costBasisRuleAuditModel({
            costBasisProfileId: configItemDetails.costBasisProfileId,
            costBasisProfileName: configItemDetails.costBasisProfileName,
            cbaRuleId: configItemDetails.cbaRuleId,
            cbaRuleName: configItemDetails.cbaRuleName,
            cbaRuleType: configItemDetails.cbaRuleType,
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

        br.sendSuccess(res, configItemDetails, 'Cost Basis Rule deleted successfully!');
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
