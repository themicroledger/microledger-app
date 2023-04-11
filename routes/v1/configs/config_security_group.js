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
const securityGroupModel = require('../../../models/configSecurityGroupModel');
const securityGroupAuditModel = require('../../../models/configSecurityGroupAuditModel');
const {Validator} = require('node-input-validator');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const securityGroupMiddleware = require('../../../middleware/config_security_group_middleware');

/**
 * @swagger
 * /api/v1/config/security-group/add:
 *  post:
 *      summary: Add Security Group
 *      tags: [Config-Security Group]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          securityCode:
 *                              type: string
 *                              default: Bullet
 *                          securityGroup:
 *                              type: string
 *                              default: Bullet
 *                          securityGroupName:
 *                              type: string
 *                              default: Bullet
 *                          assetClass:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          securityType:
 *                              type: string
 *                              default: type
 *                          securityTypeName:
 *                              type: string
 *                              default: type name
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, securityGroupMiddleware.canCreate, (req, res) => {

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
 * /api/v1/config/security-group/add/bulk:
 *  post:
 *      summary: Add Bulk Security Group Type using csv file
 *      tags: [Config-Security Group]
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
router.post("/add/bulk", authUser, securityGroupMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Security Group', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {

    const v = new Validator(req.body, {
        securityCode: 'required|string|maxLength:30',
        securityGroup: 'required|string|maxLength:30',
        securityGroupName: 'required|string|maxLength:30',
        assetClass: 'required|string',
        securityType: 'required|string|maxLength:30',
        securityTypeName: 'required|string|maxLength:30'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            return callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    securityCode: inputData.securityCode.toString().trim(),
                    securityGroup: inputData.securityGroup.toString().trim(),
                    securityGroupName: inputData.securityGroupName.toString().trim(),
                    assetClass: inputData.assetClass.toString().trim(),
                    securityType: inputData.securityType.toString().trim(),
                    securityTypeName: inputData.securityTypeName.toString().trim(),
                };

                const assetClassDetails = await IbAssetClassModel
                    .find({_id: data.assetClass, isDeleted: false,});

                if (assetClassDetails.length === 0) {
                    return callback(counter, false, 'Invalid assetClass Id => ' + data.assetClass + '!');
                }

                const configFind = await securityGroupModel.find({
                    securityCode: data.securityCode,
                    securityGroup: data.securityGroup,
                    securityGroupName: data.securityGroupName,
                    assetClass: data.assetClass,
                    securityType: data.securityType,
                    securityTypeName: data.securityTypeName,
                }).populate('assetClass');

                if (configFind.length > 0) {
                    return callback(counter, false, 'Security Group is already '
                        + 'present with Security Code => `'
                        + configFind[0].securityCode
                        + '` and Security Group => `'
                        + configFind[0].securityGroup
                        + '` and Security Group Name => `'
                        + configFind[0].securityGroupName
                        + '` and Security asset class => `'
                        + configFind[0].assetClass.assetClass
                        + '` and Security Type => `'
                        + configFind[0].securityType
                        + '` and Security Type Name => `'
                        + configFind[0].securityTypeName + '!',
                        {});
                }

                await session.startTransaction();

                const ib = new securityGroupModel({
                    securityCode: data.securityCode,
                    securityGroup: data.securityGroup,
                    securityGroupName: data.securityGroupName,
                    assetClass: data.assetClass,
                    securityType: data.securityType,
                    securityTypeName: data.securityTypeName,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new securityGroupAuditModel({
                    securityCode: ib.securityCode,
                    securityGroup: ib.securityGroup,
                    securityGroupName: ib.securityGroupName,
                    assetClass: ib.assetClass,
                    securityType: ib.securityType,
                    securityTypeName: ib.securityTypeName,
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

                callback(counter, true, 'Security Group added successfully!', ib);

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
 * /api/v1/config/security-group/update/{id}:
 *  put:
 *      summary: Update Security Group by id
 *      tags: [Config-Security Group]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Security Group Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          securityCode:
 *                              type: string
 *                              default: Bullet
 *                          securityGroup:
 *                              type: string
 *                              default: Bullet
 *                          securityGroupName:
 *                              type: string
 *                              default: Bullet
 *                          assetClass:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *                          securityType:
 *                              type: string
 *                              default: type
 *                          securityTypeName:
 *                              type: string
 *                              default: type name
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, securityGroupMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        securityCode: 'string|maxLength:30',
        securityGroup: 'string|maxLength:30',
        securityGroupName: 'string|maxLength:30',
        assetClass: 'string',
        securityType: 'string|maxLength:30',
        securityTypeName: 'string|maxLength:30'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await securityGroupModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Security Group with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.securityCode !== undefined) {
                    data.securityCode = req.body.securityCode.toString().trim();
                }

                if (req.body.securityGroup !== undefined) {
                    data.securityGroup = req.body.securityGroup.toString().trim();
                }

                if (req.body.securityGroupName !== undefined) {
                    data.securityGroupName = req.body.securityGroupName.toString().trim();
                }

                if (req.body.assetClass !== undefined) {
                    data.assetClass = req.body.assetClass.toString().trim();

                    const assetClassDetails = await IbAssetClassModel
                        .find({_id: data.assetClass, isDeleted: false,});

                    if (assetClassDetails.length === 0) {
                        return br.sendNotSuccessful(res, 'Invalid assetClass Id => ' + data.assetClass + '!');
                    }
                }

                if (req.body.securityType !== undefined) {
                    data.securityType = req.body.securityType.toString().trim();
                }

                if (req.body.securityTypeName !== undefined) {
                    data.securityTypeName = req.body.securityTypeName.toString().trim();
                }

                let configFind = await securityGroupModel.find({
                    _id: {
                        $nin: id
                    },
                    securityCode: data.securityCode !== undefined
                        ? data.securityCode
                        : configItem.securityCode,
                    securityGroup: data.securityGroup !== undefined
                        ? data.securityGroup
                        : configItem.securityGroup,
                    securityGroupName: data.securityGroupName !== undefined
                        ? data.securityGroupName
                        : configItem.securityGroupName,
                    assetClass: data.assetClass !== undefined
                        ? data.assetClass
                        : configItem.assetClass,
                    securityType: data.securityType !== undefined
                        ? data.securityType
                        : configItem.securityType,
                    securityTypeName: data.securityTypeName !== undefined
                        ? data.securityTypeName
                        : configItem.securityTypeName
                }).populate('assetClass');

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Security Group is already '
                        + 'present with Security Code => `'
                        + configFind[0].securityCode
                        + '` and Security Group => `'
                        + configFind[0].securityGroup
                        + '` and Security Group Name => `'
                        + configFind[0].securityGroupName
                        + '` and Security asset class => `'
                        + configFind[0].assetClass.assetClass
                        + '` and Security Type => `'
                        + configFind[0].securityType
                        + '` and Security Type Name => `'
                        + configFind[0].securityTypeName + '!',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await securityGroupModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await securityGroupModel.find({_id: id, isDeleted: false})
                    .populate('assetClass').session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new securityGroupAuditModel({
                    securityCode: configItemDetails.securityCode,
                    securityGroup: configItemDetails.securityGroup,
                    securityGroupName: configItemDetails.securityGroupName,
                    assetClass: configItemDetails.assetClass,
                    securityType: configItemDetails.securityType,
                    securityTypeName: configItemDetails.securityTypeName,
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

                br.sendSuccess(res, configItemDetails, 'Security Group updated successfully!');

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
 * /api/v1/config/security-group/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get Security Group Insert sample csv file
 *      tags: [Config-Security Group]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, securityGroupMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([],{
            fields: [
                'securityCode',
                'securityGroup',
                'securityGroupName',
                'assetClass',
                'securityType'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configSecurityGroupSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/security-group/get-all:
 *  get:
 *      summary: Get all Security Group
 *      tags: [Config-Security Group]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Security Groups using SecurityGroupName
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, securityGroupMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.securityGroupName = {
                $regex: new RegExp('^' + req.query.search, 'i'),
            }
        }

        let assets = await securityGroupModel.find(filter).populate('assetClass');
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/security-group/get/{id}:
 *  get:
 *      summary: get Security Group details by id
 *      tags: [Config-Security Group]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Security Group Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, securityGroupMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await securityGroupModel.find({_id: id, isDeleted: false}).populate('assetClass');

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Security Group with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/security-group/delete/{id}:
 *  delete:
 *      summary: delete Security Group details by id
 *      tags: [Config-Security Group]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Security Group Id
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
router.delete("/delete/:id", authUser, securityGroupMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await securityGroupModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Security Group with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await securityGroupModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await securityGroupModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new securityGroupAuditModel({
            securityCode: configItemDetails.securityCode,
            securityGroup: configItemDetails.securityGroup,
            securityGroupName: configItemDetails.securityGroupName,
            assetClass: configItemDetails.assetClass,
            securityType: configItemDetails.securityType,
            securityTypeName: configItemDetails.securityTypeName,
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

        br.sendSuccess(res, configItemDetails, 'Security Group deleted successfully!');
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
