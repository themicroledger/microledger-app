const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const uploader = require('../helper/file_uploader');
const IbParty = require('../../../models/configIbPartyModel');
const IbCompanyModel = require('../../../models/configIbCompanyModel');
const IbCompanyAuditModel = require('../../../models/configIbCompanyAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const ibCompanyMiddleware = require('../../../middleware/config_ib_company_middleware');

/**
 * @swagger
 * /api/v1/config/ib-company/add:
 *  post:
 *      summary: Add Ib Company
 *      tags: [Config-Ib Company]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          id:
 *                              type: string
 *                              default: FHLBDM
 *                          name:
 *                              type: string
 *                              default: Federal Home Loan Bank of Des Moines
 *                          altId:
 *                              type: string
 *                              default: FHLBDM
 *                          party:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          street:
 *                              type: string
 *                              default: 1234 South Drive
 *                          city:
 *                              type: string
 *                              default: Des Moines
 *                          poBox:
 *                              type: string
 *                              default: 12345
 *                          telephone:
 *                              type: string
 *                              default: 123-456-7890
 *                          postCode:
 *                              type: string
 *                              default: 12345-1234
 *                          telefex:
 *                              type: string
 *                              default: dqw213421
 *                          country:
 *                              type: string
 *                              default: US
 *                          swiftAddress:
 *                              type: string
 *                              default: BIC0234567
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, ibCompanyMiddleware.canCreate, (req, res) => {
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
 * /api/v1/config/ib-company/add/bulk:
 *  post:
 *      summary: Add Bulk Ib Company using csv file
 *      tags: [Config-Ib Company]
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
router.post("/add/bulk", authUser, ibCompanyMiddleware.canCreate, uploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Ib Company', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {
    const v = new Validator(inputData, {
        id: 'required|string',
        name: 'required|string',
        altId: 'string',
        party: 'required|string',
        street: 'string',
        city: 'string',
        poBox: 'string',
        telephone: 'string',
        postCode: 'string',
        telefex: 'string',
        country: 'required|string',
        swiftAddress: 'string',
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
                    altId: inputData.altId !== undefined ? inputData.altId.toString().trim() : '',
                    party: inputData.party.toString().trim(),
                    street: inputData.street !== undefined ? inputData.street.toString().trim() : '',
                    city: inputData.city !== undefined ? inputData.city.toString().trim() : '',
                    poBox: inputData.poBox !== undefined ? inputData.poBox.toString().trim() : '',
                    telephone: inputData.telephone !== undefined ? inputData.telephone.toString().trim() : '',
                    postCode: inputData.postCode !== undefined ? inputData.postCode.toString().trim() : '',
                    telefex: inputData.telefex !== undefined ? inputData.telefex.toString().trim() : '',
                    country: inputData.country.toString().trim(),
                    swiftAddress: inputData.swiftAddress !== undefined ? inputData.swiftAddress.toString().trim() : '',
                };


                if (!helper.isValidObjectId(data.party)) {
                    return callback(counter, false, 'party is not a valid Ib Party Id!');
                } else {
                    const itemDetails = await IbParty
                        .find({_id: data.party, isDeleted: false,});

                    if (itemDetails.length === 0) {
                        return callback(counter, false, 'Invalid Ib Party Id for party => ' + data.party + '!');
                    }
                }

                const configFind = await IbCompanyModel.find({
                    id: data.id,
                    name: data.name,
                    party: data.party,
                    country: data.country,
                }).populate('party');

                if (configFind.length > 0) {
                    return callback(counter, false, 'Ib Company is already '
                        + 'present with Id => `'
                        + configFind[0].id
                        + '` and Name => `'
                        + configFind[0].name
                        + '` and Ib Party => `'
                        + configFind[0].party.name
                        + '` and Country => `'
                        + configFind[0].country + ' !',
                        {});
                }

                await session.startTransaction();

                const ib = new IbCompanyModel({
                    id: data.id,
                    name: data.name,
                    altId: data.altId,
                    party: data.party,
                    street: data.street,
                    city: data.city,
                    poBox: data.poBox,
                    telephone: data.telephone,
                    postCode: data.postCode,
                    telefex: data.telefex,
                    country: data.country,
                    swiftAddress: data.swiftAddress,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new IbCompanyAuditModel({
                    id: ib.id,
                    name: ib.name,
                    altId: ib.altId,
                    party: ib.party,
                    street: ib.street,
                    city: ib.city,
                    poBox: ib.poBox,
                    telephone: ib.telephone,
                    postCode: ib.postCode,
                    telefex: ib.telefex,
                    country: ib.country,
                    swiftAddress: ib.swiftAddress,
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

                callback(counter, true, 'Ib Company added successfully!', ib);

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
 * /api/v1/config/ib-company/update/{id}:
 *  put:
 *      summary: Update Ib Company by id
 *      tags: [Config-Ib Company]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Company Id
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
 *                              default: FHLBDM
 *                          name:
 *                              type: string
 *                              default: Federal Home Loan Bank of Des Moines
 *                          altId:
 *                              type: string
 *                              default: FHLBDM
 *                          party:
 *                              type: string
 *                              default: 62ad7e73696693ca64233a4b
 *                          street:
 *                              type: string
 *                              default: 1234 South Drive
 *                          city:
 *                              type: string
 *                              default: Des Moines
 *                          poBox:
 *                              type: string
 *                              default: 12345
 *                          telephone:
 *                              type: string
 *                              default: 123-456-7890
 *                          postCode:
 *                              type: string
 *                              default: 12345-1234
 *                          telefex:
 *                              type: string
 *                              default: dqw213421
 *                          country:
 *                              type: string
 *                              default: US
 *                          swiftAddress:
 *                              type: string
 *                              default: BIC0234567
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, ibCompanyMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        id: 'string',
        name: 'string',
        portfolioGroupType: 'string',
        company: 'string',
        manager: 'string',
        portfolioCurrency: 'string',
        endOfYear: 'integer',
        portfolioGroupLevelBooking: 'boolean',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await IbCompanyModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Ib Company with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if (req.body.id !== undefined) {
                    data.id = req.body.id.toString().trim();
                }
                if (req.body.name !== undefined) {
                    data.name = req.body.name.toString().trim();
                }
                if (req.body.altId !== undefined) {
                    data.altId = req.body.altId.toString().trim();
                }

                if (req.body.party !== undefined) {
                    data.party = req.body.party.toString().trim();

                    if (!helper.isValidObjectId(data.party)) {
                        return br.sendNotSuccessful(res, 'party is not a valid Ib Party Id!');
                    } else {
                        const itemDetails = await IbParty
                            .find({_id: data.company, isDeleted: false,});

                        if (itemDetails.length === 0) {
                            return br.sendNotSuccessful(res, 'Invalid Ib Party Id for party => ' + data.party + '!');
                        }
                    }
                }

                if (req.body.street !== undefined) {
                    data.street = req.body.street.toString().trim();
                }

                if (req.body.city !== undefined) {
                    data.city = req.body.city.toString().trim();
                }

                if (req.body.poBox !== undefined) {
                    data.poBox = req.body.poBox.toString().trim();
                }

                if (req.body.telephone !== undefined) {
                    data.telephone = req.body.telephone.toString().trim();
                }

                if (req.body.postCode !== undefined) {
                    data.postCode = req.body.postCode.toString().trim();
                }

                if (req.body.telefex !== undefined) {
                    data.telefex = req.body.telefex.toString().trim();
                }

                if (req.body.country !== undefined) {
                    data.country = req.body.country.toString().trim();
                }

                if (req.body.swiftAddress !== undefined) {
                    data.swiftAddress = req.body.swiftAddress.toString().trim();
                }

                let configFind = await IbCompanyModel.find({
                    _id: {
                        $nin: id
                    },
                    id: data.id !== undefined
                        ? data.id
                        : configItem.id,
                    name: data.name !== undefined
                        ? data.name
                        : configItem.name,
                    party: data.party !== undefined
                        ? data.party
                        : configItem.party,
                    country: data.country !== undefined
                        ? data.country
                        : configItem.country
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Ib Company is already '
                        + 'present with Id => `'
                        + configFind[0].id
                        + '` and Name => `'
                        + configFind[0].name
                        + '` and Ib Party => `'
                        + configFind[0].party.name
                        + '` and Country => `'
                        + configFind[0].country + ' !',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await IbCompanyModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await IbCompanyModel.find({_id: id, isDeleted: false}).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new IbCompanyAuditModel({
                    id: configItemDetails.id,
                    name: configItemDetails.name,
                    altId: configItemDetails.altId,
                    party: configItemDetails.party,
                    street: configItemDetails.street,
                    city: configItemDetails.city,
                    poBox: configItemDetails.poBox,
                    telephone: configItemDetails.telephone,
                    postCode: configItemDetails.postCode,
                    telefex: configItemDetails.telefex,
                    country: configItemDetails.country,
                    swiftAddress: configItemDetails.swiftAddress,
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

                br.sendSuccess(res, configItemDetails, 'Ib Company updated successfully!');

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
 * /api/v1/config/ib-company/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get all Bulk Insert sample csv file
 *      tags: [Config-Ib Company]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, ibCompanyMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([], {
            fields: [
                'id',
                'name',
                'altId',
                'party',
                'street',
                'city',
                'poBox',
                'telephone',
                'postCode',
                'telefex',
                'country',
                'swiftAddress'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configIbCompanyInsertSample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-company/get-all:
 *  get:
 *      summary: Get all Ib Company
 *      tags: [Config-Ib Company]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Ib Company using name
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, ibCompanyMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.name = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await IbCompanyModel.find(filter).populate( 'party');
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-company/get/{id}:
 *  get:
 *      summary: get Ib Company details by id
 *      tags: [Config-Ib Company]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Company Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, ibCompanyMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await IbCompanyModel.find({
            _id: id,
            isDeleted: false
        }).populate( 'party');

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Ib Company with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-company/delete/{id}:
 *  delete:
 *      summary: delete Ib Company details by id
 *      tags: [Config-Ib Company]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Company Id
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
router.delete("/delete/:id", authUser, ibCompanyMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await IbCompanyModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Ib Company with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await IbCompanyModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await IbCompanyModel.find({_id: id}).populate('party').session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new IbCompanyAuditModel({
            id: configItemDetails.id,
            name: configItemDetails.name,
            altId: configItemDetails.altId,
            party: configItemDetails.party,
            street: configItemDetails.street,
            city: configItemDetails.city,
            poBox: configItemDetails.poBox,
            telephone: configItemDetails.telephone,
            postCode: configItemDetails.postCode,
            telefex: configItemDetails.telefex,
            country: configItemDetails.country,
            swiftAddress: configItemDetails.swiftAddress,
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

        br.sendSuccess(res, configItemDetails, 'Ib Company deleted successfully!');
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
