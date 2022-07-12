const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const json2csv = require('json2csv').parse;
const uploader = require('../helper/file_uploader');
const IbAssetClassModel = require('../../../models/configIbAssetClassModel');
const IbAssetStructureModel = require('../../../models/configIbStructureModel');
const IbAssetStructureAuditModel = require('../../../models/configIbStructureAuditModel');
const {processBulkInsert} = require('../helper/process_bulk_insert');
const { Validator } = require('node-input-validator');
const { authUser, isValidParamId, haveDataToUpdate } = require('../../../middleware/auth');
const ibStructureMiddleware = require('../../../middleware/config_ib_structure_middleware');

/**
 * @swagger
 * /api/v1/config/ib-structure/add:
 *  post:
 *      summary: Add Ib Structure
 *      tags: [Config-IB Structure]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          instrumentStructure:
 *                              type: string
 *                              default: Bullet
 *                          assetClass:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, ibStructureMiddleware.canCreate, (req, res) => {

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
 * /api/v1/config/ib-structure/add/bulk:
 *  post:
 *      summary: Add Bulk IB Structure using csv file
 *      tags: [Config-IB Structure]
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
router.post("/add/bulk", authUser, ibStructureMiddleware.canCreate, uploader.single('file'), async (req, res) => {
  await processBulkInsert(req, res, 'Ib Structure', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
  const v = new Validator(inputData, {
    instrumentStructure: 'required|string|maxLength:30',
    assetClass: 'required|string'
  });

  v.check().then(async (matched) => {
    if (!matched) {
      return callback(counter, false, 'Missed Required fields', v.errors);
    } else {
      let session = await mongo.startSession();
      try {
        let data = {
          instrumentStructure: inputData.instrumentStructure.toString().trim(),
          assetClass: inputData.assetClass.toString().trim()
        };

        const assetClassDetails = await IbAssetClassModel
            .find({_id: data.assetClass, isDeleted: false,});

        if(assetClassDetails.length === 0){
          return callback(counter, false, 'Invalid assetClass Id => ' + data.assetClass + '!');
        }

        const structures = await IbAssetStructureModel.find({
          instrumentStructure: data.instrumentStructure,
          assetClass: data.assetClass
        }).populate('assetClass');

        if(structures.length > 0){
          return callback(counter, false,  'Ib Structure is already present with Instrument Structure => `'
              + structures[0].instrumentStructure
              + '` and asset class => `'
              + structures[0].assetClass.assetClass
              + '` with structure id '
              + structures[0].structureId +'!', {});
        }

        await session.startTransaction();

        const ib = new IbAssetStructureModel({
          instrumentStructure: data.instrumentStructure,
          assetClass: data.assetClass
        }, { session: session });
        await ib.save();

        const auditData = new IbAssetStructureAuditModel({
          structureId: ib.structureId,
          assetClass: ib.assetClass,
          instrumentStructure: ib.instrumentStructure,
          isDeleted: ib.isDeleted,
          deletedBy: ib.deletedBy,
          deleteReason: ib.deleteReason,
          actionItemId: ib._id,
          action: helper.sysConst.permissionAccessTypes.CREATE,
          actionDate: new Date(),
          actionBy: req.appCurrentUserData._id,
        }, { session: session });
        await auditData.save();

        await session.commitTransaction();

        return callback(counter, true, 'Ib Structure added successfully!', ib);

      } catch (error) {
        if(session.inTransaction()){
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
 * /api/v1/config/ib-structure/update/{id}:
 *  put:
 *      summary: Update Ib Structure by id
 *      tags: [Config-IB Structure]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Structure Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          instrumentStructure:
 *                              type: string
 *                              default: Bullet
 *                          assetClass:
 *                              type: string
 *                              default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, ibStructureMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

  const v = new Validator(req.body, {
    instrumentStructure: 'string|maxLength:30',
    assetClass: 'string'
  });

  v.check().then( async (matched) => {
    if (!matched) {
      br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
    } else {
      let session = await mongo.startSession();
      try {
        const id = req.validParamId;
        let configItem = await IbAssetStructureModel.find({_id: id, isDeleted: false});

        if(configItem.length === 0){
          return br.sendNotSuccessful(res, `Ib Structure with id => ${id} not found or deleted!`);
        }
        configItem = configItem[0];

        let data = {};

        if(req.body.instrumentStructure !== undefined){
          data.instrumentStructure =  req.body.instrumentStructure.toString().trim();
        }

        if(req.body.assetClass !== undefined){
          data.assetClass = req.body.assetClass.toString().trim();

          const assetClassDetails = await IbAssetClassModel
              .find({_id: data.assetClass, isDeleted: false,});

          if(assetClassDetails.length === 0){
            return br.sendNotSuccessful(res, 'Invalid assetClass Id => ' + data.assetClass + '!');
          }
        }

        let structures = await IbAssetStructureModel.find({
          _id: {
            $nin: id
          },
          instrumentStructure: data.instrumentStructure !== undefined
              ? data.instrumentStructure
              : configItem.instrumentStructure,
          assetClass: data.assetClass !== undefined
              ? data.assetClass
              : configItem.assetClass
        }).populate('assetClass');

        if(structures.length > 0){
          return br.sendNotSuccessful(res, 'Ib Structure is already present with Instrument Structure => `' + structures[0].instrumentStructure + '` and asset class => `' + structures[0].assetClass.assetClass + '` with structure id ' + structures[0].structureId +'!', {});
        }

        await session.startTransaction();

        data.changedByUser = req.appCurrentUserData._id;
        data.changedDate = new Date();

        await IbAssetStructureModel.updateOne({_id: id}, data).session(session);

        let structureDetails = await IbAssetStructureModel.find({_id: id, isDeleted: false})
            .populate('assetClass').session(session);
        structureDetails = structureDetails[0];

        const auditData = new IbAssetStructureAuditModel({
          structureId: structureDetails.structureId,
          assetClass: structureDetails.assetClass._id,
          instrumentStructure: structureDetails.instrumentStructure,
          isDeleted: structureDetails.isDeleted,
          deletedBy: structureDetails.deletedBy,
          deleteReason: structureDetails.deleteReason,
          actionItemId: structureDetails._id,
          action: helper.sysConst.permissionAccessTypes.EDIT,
          actionDate: new Date(),
          actionBy: structureDetails.createdByUser,
        }, { session: session });
        await auditData.save();

        await session.commitTransaction();

        br.sendSuccess(res, structureDetails, 'Ib Structure updated successfully!');

      } catch (error) {
        if(session.inTransaction()){
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
 * /api/v1/config/ib-structure/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get Ib Structure Insert sample csv file
 *      tags: [Config-IB Structure]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, ibStructureMiddleware.canRead,*/ async (req, res) => {
  try {
    let csvString = json2csv([],{
      fields: [
        'instrumentStructure',
        'assetClass'
      ]
    });
    res.setHeader('Content-disposition', 'attachment; filename=configIbStructureInsertSample.csv');
    res.set('Content-Type', 'text/csv');
    res.status(200).send(csvString);
  } catch (error) {
    logger.error(error);
    br.sendServerError(res, {});
  }
});

/**
 * @swagger
 * /api/v1/config/ib-structure/get-all:
 *  get:
 *      summary: Get all Ib Structure
 *      tags: [Config-IB Structure]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search structure using instrument structure Name
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, ibStructureMiddleware.canRead, async (req, res) => {
  try {
    let filter = {
      isDeleted: false,
    }

    if(req.query.search !== undefined && req.query.search.length > 0){
      filter.instrumentStructure = {
        $regex: '/^' + req.query.search + '/i',
      }
    }

    let assets = await IbAssetStructureModel.find(filter).populate('assetClass');
    br.sendSuccess(res, assets);
  } catch (error) {
    logger.error(error);
    br.sendServerError(res, {});
  }
});

/**
 * @swagger
 * /api/v1/config/ib-structure/get/{id}:
 *  get:
 *      summary: get Ib Structure details by id
 *      tags: [Config-IB Structure]
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
router.get("/get/:id", authUser, ibStructureMiddleware.canRead, isValidParamId, async (req, res) => {
  try {
    const id = req.validParamId;
    let assetDetails = await IbAssetStructureModel.find({_id: id, isDeleted: false}).populate('assetClass');

    if(assetDetails.length === 0){
      return br.sendNotSuccessful(res, `Ib Structure with id => ${id} not found or deleted!`);
    }

    br.sendSuccess(res, assetDetails[0]);
  } catch (error) {
    logger.error(error);
    br.sendServerError(res, {});
  }
});

/**
 * @swagger
 * /api/v1/config/ib-structure/delete/{id}:
 *  delete:
 *      summary: delete Ib Structure details by id
 *      tags: [Config-IB Structure]
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
router.delete("/delete/:id", authUser, ibStructureMiddleware.canDelete, isValidParamId, async (req, res) => {
  let session = await mongo.startSession();

  try {
    const id = req.validParamId;
    let configItemDetails = await IbAssetStructureModel.find({_id: id, isDeleted: false});

    if(configItemDetails.length === 0){
      return br.sendNotSuccessful(res, `Ib Structure with id => ${id} not found or deleted!`);
    }

    await session.startTransaction();

    await IbAssetStructureModel.updateOne({_id: id, isDeleted: false}, {
      isDeleted: true,
      deletedBy : req.appCurrentUserData._id,
      deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
    }).session(session);

    configItemDetails = await IbAssetStructureModel.find({_id: id}).session(session);
    configItemDetails = configItemDetails[0];

    const auditData = new IbAssetStructureAuditModel({
      structureId: configItemDetails.structureId,
      assetClass: configItemDetails.assetClass,
      instrumentStructure: configItemDetails.instrumentStructure,
      isDeleted: configItemDetails.isDeleted,
      deletedBy: configItemDetails.deletedBy,
      deleteReason: configItemDetails.deleteReason,
      actionItemId: configItemDetails._id,
      action: helper.sysConst.permissionAccessTypes.DELETE,
      actionDate: new Date(),
      actionBy: configItemDetails.createdByUser,
    }, { session: session });
    await auditData.save();

    await session.commitTransaction();

    br.sendSuccess(res, configItemDetails, 'Ib Structure deleted successfully!');
  } catch (error) {

    if(session.inTransaction()){
      await session.abortTransaction();
    }
    br.sendServerError(res, {});

  } finally {
    await session.endSession();
  }
});

module.exports = router;
