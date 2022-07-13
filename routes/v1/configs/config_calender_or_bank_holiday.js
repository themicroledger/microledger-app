const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const json2csv = require('json2csv').parse;
const uploader = require('../helper/file_uploader');
const {processBulkInsert} = require('../helper/process_bulk_insert');
const calenderOrBankHolidayModel = require('../../../models/configCalenderOrBankHolidayModel');
const calenderOrBankHolidayAuditModel = require('../../../models/configCalenderOrBankHolidayAuditModel');
const {Validator} = require('node-input-validator');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const calenderMiddleware = require('../../../middleware/config_calender_or_bank_holiday_middleware');

/**
 * @swagger
 * /api/v1/config/calender-or-bank-holiday/add:
 *  post:
 *      summary: Add Calender Or Bank Holiday
 *      tags: [Config-Calender Or Bank Holiday]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          calenderId:
 *                              type: string
 *                              default: US FI
 *                          calenderName:
 *                              type: string
 *                              default: US Fixed Income Calendar
 *                          country:
 *                              type: string
 *                              default: US
 *                          irregularNonBankingDays:
 *                              type: array
 *                              items:
 *                                  type: object
 *                                  properties:
 *                                      date:
 *                                          type: Date
 *                                          default: 20-Jan-2022
 *                                      description:
 *                                          type: String
 *                                          default: description
 *                          monday:
 *                              type: bool
 *                              default: false
 *                          tuesday:
 *                              type: bool
 *                              default: false
 *                          wednesday:
 *                              type: bool
 *                              default: false
 *                          thursday:
 *                              type: bool
 *                              default: false
 *                          friday:
 *                              type: bool
 *                              default: false
 *                          saturday:
 *                              type: bool
 *                              default: false
 *                          sunday:
 *                              type: bool
 *                              default: false
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, calenderMiddleware.canCreate, (req, res) => {

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
 * /api/v1/config/calender-or-bank-holiday/add/bulk:
 *  post:
 *      summary: Add Bulk Calender Or Bank Holiday Type using csv file
 *      tags: [Config-Calender Or Bank Holiday]
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
router.post("/add/bulk", authUser, calenderMiddleware.canCreate, uploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Calender Or Bank Holiday', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {

    const v = new Validator(inputData, {
        calenderId: 'required|string',
        calenderName: 'required|string',
        country: 'required|string'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    calenderId: inputData.calenderId.toString().trim(),
                    calenderName: inputData.calenderName.toString().trim(),
                    country: inputData.country.toString().trim(),
                    irregularNonBankingDays: [],
                    sunday: inputData.sunday !== undefined ? helper.getBoolean(inputData.sunday) : false,
                    monday: inputData.monday !== undefined ? helper.getBoolean(inputData.monday) : false,
                    tuesday: inputData.tuesday !== undefined ? helper.getBoolean(inputData.tuesday) : false,
                    wednesday: inputData.wednesday !== undefined ? helper.getBoolean(inputData.wednesday) : false,
                    thursday: inputData.thursday !== undefined ? helper.getBoolean(inputData.thursday) : false,
                    friday: inputData.friday !== undefined ? helper.getBoolean(inputData.friday) : false,
                    saturday: inputData.saturday !== undefined ? helper.getBoolean(inputData.saturday) : false,
                };

                const configFind = await calenderOrBankHolidayModel.find({
                    calenderId: data.calenderId,
                    calenderName: data.calenderName,
                    country: data.country,
                });

                if (configFind.length > 0) {
                    return callback(counter, false, 'Calender Or Bank Holiday is already '
                        + 'present with Calender Id => `'
                        + configFind[0].calenderId
                        + '` and Calender Name => `'
                        + configFind[0].calenderName
                        + '` and Country => `'
                        + configFind[0].country + '!',
                        {});
                }

                if(inputData.irregularNonBankingDays !== undefined && Array.isArray(inputData.irregularNonBankingDays)){
                    let dates = [];
                    inputData.irregularNonBankingDays.forEach((item) => {
                        if(item.date !== undefined && item.description !== undefined){
                            dates.push({
                                date: Date(item.date.toString().trim()),
                                description: item.description
                            })
                        }
                    });
                    data.irregularNonBankingDays = dates;
                }

                await session.startTransaction();

                const ib = new calenderOrBankHolidayModel({
                    calenderId: data.calenderId,
                    calenderName: data.calenderName,
                    country: data.country,
                    irregularNonBankingDays: data.irregularNonBankingDays,
                    sunday: data.sunday,
                    monday: data.monday,
                    tuesday: data.tuesday,
                    wednesday: data.wednesday,
                    thursday: data.thursday,
                    friday: data.friday,
                    saturday: data.saturday,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new calenderOrBankHolidayAuditModel({
                    calenderId: ib.calenderId,
                    calenderName: ib.calenderName,
                    country: ib.country,
                    irregularNonBankingDays: ib.irregularNonBankingDays,
                    sunday: ib.sunday,
                    monday: ib.monday,
                    tuesday: ib.tuesday,
                    wednesday: ib.wednesday,
                    thursday: ib.thursday,
                    friday: ib.friday,
                    saturday: ib.saturday,
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

                callback(counter, true, 'Calender Or Bank Holiday added successfully!', ib);

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
 * /api/v1/config/calender-or-bank-holiday/update/{id}:
 *  put:
 *      summary: Update Calender Or Bank Holiday by id
 *      tags: [Config-Calender Or Bank Holiday]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Calender Or Bank Holiday Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          calenderId:
 *                              type: string
 *                              default: US FI
 *                          calenderName:
 *                              type: string
 *                              default: US Fixed Income Calendar
 *                          country:
 *                              type: string
 *                              default: US
 *                          irregularNonBankingDays:
 *                              type: array
 *                              items:
 *                                  type: object
 *                                  properties:
 *                                      date:
 *                                          type: Date
 *                                          default: 20-Jan-2022
 *                                      description:
 *                                          type: String
 *                                          default: description
 *                          monday:
 *                              type: bool
 *                              default: false
 *                          tuesday:
 *                              type: bool
 *                              default: false
 *                          wednesday:
 *                              type: bool
 *                              default: false
 *                          thursday:
 *                              type: bool
 *                              default: false
 *                          friday:
 *                              type: bool
 *                              default: false
 *                          saturday:
 *                              type: bool
 *                              default: false
 *                          sunday:
 *                              type: bool
 *                              default: false
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, calenderMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        calenderId: 'string',
        calenderName: 'string',
        country: 'string'
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await calenderOrBankHolidayModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Calender Or Bank Holiday with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.calenderId !== undefined) {
                    data.calenderId = req.body.calenderId.toString().trim();
                }

                if (req.body.calenderName !== undefined) {
                    data.calenderName = req.body.calenderName.toString().trim();
                }

                if (req.body.country !== undefined) {
                    data.country = req.body.country.toString().trim();
                }

                if(req.body.irregularNonBankingDays !== undefined && Array.isArray(req.body.irregularNonBankingDays)){
                    let dates = [];
                    req.body.irregularNonBankingDays.forEach((item) => {
                        if(item.date !== undefined && item.description !== undefined){
                            dates.push({
                                date: Date(item.date.toString().trim()),
                                description: item.description
                            })
                        }
                    });
                    data.irregularNonBankingDays = dates;
                }

                if (req.body.sunday !== undefined) {
                    data.sunday = helper.getBoolean(req.body.sunday);
                }

                if (req.body.monday !== undefined) {
                    data.monday = helper.getBoolean(req.body.monday);
                }

                if (req.body.tuesday !== undefined) {
                    data.tuesday = helper.getBoolean(req.body.tuesday);
                }

                if (req.body.wednesday !== undefined) {
                    data.wednesday = helper.getBoolean(req.body.wednesday);
                }

                if (req.body.thursday !== undefined) {
                    data.thursday = helper.getBoolean(req.body.thursday);
                }

                if (req.body.friday !== undefined) {
                    data.friday = helper.getBoolean(req.body.friday);
                }

                if (req.body.saturday !== undefined) {
                    data.saturday = helper.getBoolean(req.body.saturday);
                }

                let configFind = await calenderOrBankHolidayModel.find({
                    _id: {
                        $nin: id
                    },
                    calenderId: data.calenderId !== undefined
                        ? data.calenderId
                        : configItem.calenderId,
                    calenderName: data.calenderName !== undefined
                        ? data.calenderName
                        : configItem.calenderName,
                    country: data.country !== undefined
                        ? data.country
                        : configItem.country,
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Calender Or Bank Holiday is already '
                        + 'present with Cost Basis Profile Id => `'
                        + configFind[0].calenderId
                        + '` and Calender Name => `'
                        + configFind[0].calenderName
                        + '` and Country => `'
                        + configFind[0].country + '!',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await calenderOrBankHolidayModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await calenderOrBankHolidayModel.find({_id: id, isDeleted: false}).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new calenderOrBankHolidayAuditModel({
                    calenderId: configItemDetails.calenderId,
                    calenderName: configItemDetails.calenderName,
                    country: configItemDetails.country,
                    irregularNonBankingDays: configItemDetails.irregularNonBankingDays,
                    sunday: configItemDetails.sunday,
                    monday: configItemDetails.monday,
                    tuesday: configItemDetails.tuesday,
                    wednesday: configItemDetails.wednesday,
                    thursday: configItemDetails.thursday,
                    friday: configItemDetails.friday,
                    saturday: configItemDetails.saturday,
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

                br.sendSuccess(res, configItemDetails, 'Calender Or Bank Holiday updated successfully!');

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
 * /api/v1/config/calender-or-bank-holiday/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get Calender Or Bank Holiday Insert sample csv file
 *      tags: [Config-Calender Or Bank Holiday]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, calenderMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([],{
            fields: [
                'calenderId',
                'calenderName',
                'country',
                'irregularNonBankingDays',
                'sunday',
                'monday',
                'tuesday',
                'wednesday',
                'thursday',
                'friday',
                'saturday'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configCalenderOrBankHolidaySample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/calender-or-bank-holiday/get-all:
 *  get:
 *      summary: Get all Calender Or Bank Holiday
 *      tags: [Config-Calender Or Bank Holiday]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Calender Name using calenderOrBankHoliday
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, calenderMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.calenderName = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await calenderOrBankHolidayModel.find(filter);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/calender-or-bank-holiday/get/{id}:
 *  get:
 *      summary: get Calender Or Bank Holiday details by id
 *      tags: [Config-Calender Or Bank Holiday]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Calender Or Bank Holiday Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, calenderMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await calenderOrBankHolidayModel.find({_id: id, isDeleted: false});

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Calender Or Bank Holiday with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/calender-or-bank-holiday/delete/{id}:
 *  delete:
 *      summary: delete Calender Or Bank Holiday details by id
 *      tags: [Config-Calender Or Bank Holiday]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Calender Or Bank Holiday Id
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
router.delete("/delete/:id", authUser, calenderMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await calenderOrBankHolidayModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Calender Or Bank Holiday with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await calenderOrBankHolidayModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await calenderOrBankHolidayModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new calenderOrBankHolidayAuditModel({
            calenderId: configItemDetails.calenderId,
            calenderName: configItemDetails.calenderName,
            country: configItemDetails.country,
            irregularNonBankingDays: configItemDetails.irregularNonBankingDays,
            sunday: configItemDetails.sunday,
            monday: configItemDetails.monday,
            tuesday: configItemDetails.tuesday,
            wednesday: configItemDetails.wednesday,
            thursday: configItemDetails.thursday,
            friday: configItemDetails.friday,
            saturday: configItemDetails.saturday,
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

        br.sendSuccess(res, configItemDetails, 'Calender Or Bank Holiday deleted successfully!');
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
