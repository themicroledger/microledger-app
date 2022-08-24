const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const br = helper.baseResponse;
const router = new express.Router();
const json2csv = require('json2csv').parse;
const { bulkUploader } = require('../helper/file_uploader');
const {processBulkInsert} = require('../helper/process_bulk_insert');
const IbTransactionStatusModel = require('../../../models/configIbTransactionStatusModel');
const IbTransactionStatusAuditModel = require('../../../models/configIbTransactionStatusAuditModel');
const { Validator } = require('node-input-validator');
const { authUser, isValidParamId, haveDataToUpdate } = require('../../../middleware/auth');
const ibTransactionStatusMiddleware = require('../../../middleware/config_ib_transaction_status_middleware');

/**
 * @swagger
 * /api/v1/config/ib-transaction-status/add:
 *  post:
 *      summary: Add Ib Transaction Status
 *      tags: [Config-Ib Transaction Status]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          transactionStatus:
 *                              type: string
 *                              default: Initial Booking
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, ibTransactionStatusMiddleware.canCreate, (req, res) => {

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
 * /api/v1/config/ib-transaction-status/add/bulk:
 *  post:
 *      summary: Add Bulk Ib Transaction Status Type using csv file
 *      tags: [Config-Ib Transaction Status]
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
router.post("/add/bulk", authUser, ibTransactionStatusMiddleware.canCreate, bulkUploader.single('file'), async (req, res) => {
  await processBulkInsert(req, res, 'Security Group', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {

  const v = new Validator(inputData, {
    transactionStatus: 'required|string|maxLength:20',
  });

  v.check().then(async (matched) => {
    if (!matched) {
      callback(counter, false, 'Missed Required fields', v.errors);
    } else {
      let session = await mongo.startSession();
      try {
        let data = {
          transactionStatus: req.body.transactionStatus.toString().trim()
        };

        const configFind = await IbTransactionStatusModel.find({transactionStatus: data.transactionStatus});

        if(configFind.length > 0){
          return callback(counter, false, 'Transaction Status `' + data.transactionStatus + '` is already present in the database!', {});
        }

        await session.startTransaction();

        const ib = new IbTransactionStatusModel({
          transactionStatus: data.transactionStatus,
          createdByUser: req.appCurrentUserData._id
        }, { session: session });
        await ib.save();

        const auditData = new IbTransactionStatusAuditModel({
          transactionId: ib.transactionId,
          transactionStatus: ib.transactionStatus,
          changedByUser: ib.changedByUser,
          changedDate: ib.changedDate,
          createdByUser: ib.createdByUser,
          actionItemId: ib._id,
          action: helper.sysConst.permissionAccessTypes.CREATE,
          actionDate: new Date(),
          actionBy: req.appCurrentUserData._id,
        }, { session: session });
        await auditData.save();

        await session.commitTransaction();

        callback(counter, true, 'Ib Transaction Status added successfully!', ib);

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
 * /api/v1/config/ib-transaction-status/update/{id}:
 *  put:
 *      summary: Update Ib Transaction Status by id
 *      tags: [Config-Ib Transaction Status]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Transaction Status Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          transactionStatus:
 *                              type: string
 *                              default: Initial Booking
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, ibTransactionStatusMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

  const v = new Validator(req.body, {
    transactionStatus: 'string|maxLength:20'
  });

  v.check().then( async (matched) => {
    if (!matched) {
      br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
    } else {
      let session = await mongo.startSession();
      try {
        const id = req.validParamId;
        let asset = await IbTransactionStatusModel.find({_id: id, isDeleted: false});

        if(asset.length === 0){
          return br.sendNotSuccessful(res, `Ib Transaction Status with id => ${id} not found or deleted!`);
        }

        let data = {};

        if(req.body.transactionStatus !== undefined){
          data.transactionStatus =  req.body.transactionStatus.toString().trim();
        }

        let assets = await IbTransactionStatusModel.find({
          _id: {
            $nin: id
          },
          transactionStatus: data.transactionStatus
        });

        if(assets.length > 0){
          return br.sendNotSuccessful(res, 'Transaction Status `'
              + data.transactionStatus
              + '` is already present in the database!', {});
        }

        await session.startTransaction();

        data.changedByUser = req.appCurrentUserData._id;
        data.changedDate = new Date();

        await IbTransactionStatusModel.updateOne({_id: id}, data).session(session);

        let assetDetails = await IbTransactionStatusModel.find({_id: id, isDeleted: false}).session(session);
        assetDetails = assetDetails[0];

        const auditData = new IbTransactionStatusAuditModel({
          transactionId: assetDetails.transactionId,
          transactionStatus: assetDetails.transactionStatus,
          changedByUser: assetDetails.changedByUser,
          changedDate: assetDetails.changedDate,
          createdByUser: assetDetails.createdByUser,
          actionItemId: assetDetails._id,
          action: helper.sysConst.permissionAccessTypes.EDIT,
          actionDate: new Date(),
          actionBy: req.appCurrentUserData._id,
        }, { session: session });
        await auditData.save();

        await session.commitTransaction();

        br.sendSuccess(res, assetDetails, 'Ib Transaction Status updated successfully!');
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
 * /api/v1/config/ib-transaction-status/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get Ib Transaction Status Insert sample csv file
 *      tags: [Config-Ib Transaction Status]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, ibTransactionStatusMiddleware.canRead,*/ async (req, res) => {
  try {
    let csvString = json2csv([],{
      fields: [
        'transactionStatus'
      ]
    });
    res.setHeader('Content-disposition', 'attachment; filename=configIbTransactionStatusSample.csv');
    res.set('Content-Type', 'text/csv');
    res.status(200).send(csvString);
  } catch (error) {
    logger.error(error);
    br.sendServerError(res, {});
  }
});

/**
 * @swagger
 * /api/v1/config/ib-transaction-status/get-all:
 *  get:
 *      summary: Get all Ib Interest Types
 *      tags: [Config-Ib Transaction Status]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Ib Transaction Status using transactionStatus Name
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, ibTransactionStatusMiddleware.canRead, async (req, res) => {
  try {
    let filter = {
      isDeleted: false,
    }

    if(req.query.search !== undefined && req.query.search.length > 0){
      filter.transactionStatus = {
        $regex: '/^' + req.query.search + '/i',
      }
    }

    let assets = await IbTransactionStatusModel.find(filter);
    br.sendSuccess(res, assets);
  } catch (error) {
    br.sendServerError(res, error);
  }
});

/**
 * @swagger
 * /api/v1/config/ib-transaction-status/get/{id}:
 *  get:
 *      summary: get Ib Transaction Status details by id
 *      tags: [Config-Ib Transaction Status]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Transaction Status Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, ibTransactionStatusMiddleware.canRead, isValidParamId, async (req, res) => {
  try {
    const id = req.validParamId;
    let assetDetails = await IbTransactionStatusModel.find({_id: id, isDeleted: false});

    if(assetDetails.length === 0){
      return br.sendNotSuccessful(res, `Ib Transaction Status with id => ${id} not found or deleted!`);
    }

    br.sendSuccess(res, assetDetails[0]);
  } catch (error) {
    br.sendServerError(res, error);
  }
});

/**
 * @swagger
 * /api/v1/config/ib-transaction-status/delete/{id}:
 *  delete:
 *      summary: delete Ib Transaction Status details by id
 *      tags: [Config-Ib Transaction Status]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Transaction Status Id
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
router.delete("/delete/:id", authUser, ibTransactionStatusMiddleware.canDelete, isValidParamId, async (req, res) => {
  let session = await mongo.startSession();

  try {
    const id = req.validParamId;
    let assetDetails = await IbTransactionStatusModel.find({_id: id, isDeleted: false});

    if(assetDetails.length === 0){
      return br.sendNotSuccessful(res, `Ib Transaction Status with id => ${id} not found or deleted!`);
    }

    await session.startTransaction();

    await IbTransactionStatusModel.updateOne({_id: id, isDeleted: false}, {
      isDeleted: true,
      deletedBy : req.appCurrentUserData._id,
      deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
    }).session(session);

    assetDetails = await IbTransactionStatusModel.find({_id: id}).session(session);
    assetDetails = assetDetails[0];

    const auditData = new IbTransactionStatusAuditModel({
      transactionId: assetDetails.transactionId,
      transactionStatus: assetDetails.transactionStatus,
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
    }, { session: session });
    await auditData.save();

    await session.commitTransaction();

    br.sendSuccess(res, {}, 'Ib Transaction Status details deleted');
  } catch (error) {
    if(session.inTransaction()){
      await session.abortTransaction();
    }
    br.sendServerError(res, error);

  } finally {
    await session.endSession();
  }
});

module.exports = router;
