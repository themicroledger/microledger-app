const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const json2csv = require('json2csv').parse;
const uploader = require('../helper/file_uploader');
const {processBulkInsert} = require('../helper/process_bulk_insert');
const CurrencyModel = require('../../../models/configCurrencyModel');
const IbPartyModel = require('../../../models/configIbPartyModel');
const IbPartyAuditModel = require('../../../models/configIbPartyAuditModel');
const {Validator} = require('node-input-validator');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');
const ibPartyMiddleware = require('../../../middleware/config_ib_party_middleware');

/**
 * @swagger
 * /api/v1/config/ib-party/add:
 *  post:
 *      summary: Add Ib Party
 *      tags: [Config-Ib Party]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          partyId:
 *                              type: string
 *                              default: AUL
 *                          name:
 *                              type: string
 *                              default: American Universal Life
 *                          altId:
 *                              type: string
 *                              default: AUL
 *                          parentParty:
 *                              type: string
 *                              default: 62abf3e623bf17b6ca8dffa3
 *                          street:
 *                              type: string
 *                              default: 423 Lithio Drive
 *                          city:
 *                              type: string
 *                              default: Indianapolis
 *                          poBox:
 *                              type: string
 *                              default: Indianapolis
 *                          telephone:
 *                              type: string
 *                              default: Indianapolis
 *                          postcode:
 *                              type: string
 *                              default: Indianapolis
 *                          teleflex:
 *                              type: string
 *                              default: Indianapolis
 *                          country:
 *                              type: string
 *                              default: US
 *                          swiftAddress:
 *                              type: string
 *                              default: Indianapolis
 *                          partyRole:
 *                              type: array
 *                              items:
 *                                  type: String
 *                              default: [Bank]
 *                          contactPersonId:
 *                              type: String
 *                              default: 1234
 *                          contactName:
 *                              type: String
 *                              default: Alan
 *                          contactTitle:
 *                              type: String
 *                              default: CEO
 *                          contactTelephone:
 *                              type: String
 *                              default: 345-987-1234
 *                          contactEmail:
 *                              type: String
 *                              default: khjdao@ojbn.ovn
 *                          contactCity:
 *                              type: String
 *                              default: city
 *                          contactCountry:
 *                              type: String
 *                              default: USA
 *                          capitalAmount:
 *                              type: Number
 *                              default: 0
 *                          currency:
 *                              type: String
 *                              default: 62abf3e623bf17b6ca8dffa3
 *                          fromDate:
 *                              type: Date
 *                              default: null
 *                          isItAsset:
 *                              type: bool
 *                              default: false
 *                          additionPartyData:
 *                              type: array
 *                              items:
 *                                  type: object
 *                                  properties:
 *                                      name:
 *                                          type: String
 *                                          default: additional field 1
 *                                      value:
 *                                          type: String
 *                                          default: field value
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/add", authUser, ibPartyMiddleware.canCreate, (req, res) => {

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
 * /api/v1/config/ib-party/add/bulk:
 *  post:
 *      summary: Add Bulk Ib Party Type using csv file
 *      tags: [Config-Ib Party]
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
router.post("/add/bulk", authUser, ibPartyMiddleware.canCreate, uploader.single('file'), async (req, res) => {
    await processBulkInsert(req, res, 'Ib Party', insertData);
});

function insertData(req, inputData, counter = 0, callback, onError) {

    const v = new Validator(inputData, {
        partyId: 'required|string',
        name: 'required|string',
        altId: 'string',
        parentParty: 'string',
        street: 'string',
        city: 'string',
        poBox: 'string',
        telephone: 'string',
        postcode: 'string',
        teleflex: 'string',
        country: 'required|string',
        swiftAddress: 'string',
        partyRole: 'array',
        //contactPersonId: '',
        contactName: 'string',
        contactTitle: 'string',
        contactTelephone: 'string',
        contactEmail: 'string',
        contactCity: 'string',
        contactCountry: 'string',
        capitalAmount: 'decimal',
        currency: 'string',
        fromDate: 'string',
        isItAsset: 'boolean',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            callback(counter, false, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                let data = {
                    partyId: inputData.partyId.toString().trim(),
                    name: inputData.name.toString().trim(),
                    altId: inputData.altId !== undefined ? inputData.altId.toString().trim() : null,
                    parentParty: inputData.parentParty !== undefined && inputData.parentParty !== null && inputData.parentParty.length > 0 ? inputData.parentParty.toString().trim() : null,
                    street: inputData.street !== undefined ? inputData.street.toString().trim() : null,
                    city: inputData.city !== undefined ? inputData.city.toString().trim() : null,
                    poBox: inputData.poBox !== undefined ? inputData.poBox.toString().trim() : null,
                    telephone: inputData.telephone !== undefined ? inputData.telephone.toString().trim() : null,
                    postcode: inputData.postcode !== undefined ? inputData.postcode.toString().trim() : null,
                    teleflex: inputData.teleflex !== undefined ? inputData.teleflex.toString().trim() : null,
                    country: inputData.country !== undefined ? inputData.country.toString().trim() : null,
                    swiftAddress: inputData.swiftAddress !== undefined ? inputData.swiftAddress.toString().trim() : null,
                    partyRole: inputData.partyRole !== undefined && Array.isArray(inputData.partyRole) ? inputData.partyRole : [],
                    contactPersonId: inputData.contactPersonId !== undefined ? inputData.contactPersonId.toString().trim() : null,
                    contactName: inputData.contactName !== undefined ? inputData.contactName.toString().trim() : null,
                    contactTitle: inputData.contactTitle !== undefined ? inputData.contactTitle.toString().trim() : null,
                    contactTelephone: inputData.contactTelephone !== undefined ? inputData.contactTelephone.toString().trim() : null,
                    contactEmail: inputData.contactEmail !== undefined ? inputData.contactEmail.toString().trim() : null,
                    contactCity: inputData.contactCity !== undefined ? inputData.contactCity.toString().trim() : null,
                    contactCountry: inputData.contactCountry !== undefined ? inputData.contactCountry.toString().trim() : null,
                    capitalAmount: inputData.capitalAmount !== undefined ? parseInt(inputData.capitalAmount.toString().trim()) : 0,
                    currency: inputData.currency !== undefined && inputData.currency !== null && inputData.currency.length > 0 ? inputData.currency.toString().trim() : null,
                    fromDate: inputData.fromDate !== undefined ? new Date(inputData.fromDate) : null,
                    isItAsset: inputData.isItAsset !== undefined ? helper.getBoolean(inputData.isItAsset) : false,
                    additionPartyData: []
                };

                const configFind = await IbPartyModel.find({
                    partyId: data.partyId,
                    name: data.name,
                    country: data.country,
                });

                if (configFind.length > 0) {
                    return callback(counter, false, 'Ib Party is already '
                        + 'present with Party Id => `'
                        + configFind[0].partyId
                        + '` and Party Name => `'
                        + configFind[0].name
                        + '` and Country => `'
                        + configFind[0].country + '!',
                        {});
                }


                if(data.parentParty !== null){
                    const parentPartyDetails = await IbPartyModel
                        .find({_id: data.parentParty, isDeleted: false,});

                    if(parentPartyDetails.length === 0){
                        return callback(counter, false, 'Invalid Ib Party Id => ' + data.parentParty + '!');
                    }
                }

                if(data.partyRole.length === 0){
                    return callback(counter, false, 'Please add minimum one Party Role !');
                }

                if(data.currency !== null){
                    const currencyDetails = await CurrencyModel
                        .find({_id: data.currency, isDeleted: false,});

                    if(currencyDetails.length === 0){
                        return callback(counter, false, 'Invalid Currency Id => ' + data.currency + '!');
                    }
                }

                if(inputData.additionPartyData !== undefined && Array.isArray(inputData.additionPartyData)){
                    let additionalData = [];
                    inputData.additionPartyData.forEach((item) => {
                        if(item.name !== undefined && item.value !== undefined){
                            additionalData.push({
                                name: item.name,
                                value: item.value
                            });
                        }
                    });
                    data.additionPartyData = additionalData;
                }

                await session.startTransaction();

                const ib = new IbPartyModel({
                    partyId: data.partyId,
                    name: data.name,
                    altId: data.altId,
                    parentParty: data.parentParty,
                    street: data.street,
                    city: data.city,
                    poBox: data.poBox,
                    telephone: data.telephone,
                    postcode: data.postcode,
                    teleflex: data.teleflex,
                    country: data.country,
                    swiftAddress: data.swiftAddress,
                    partyRole: data.partyRole,
                    contactPersonId: data.contactPersonId,
                    contactName: data.contactName,
                    contactTitle: data.contactTitle,
                    contactTelephone: data.contactTelephone,
                    contactEmail: data.contactEmail,
                    contactCity: data.contactCity,
                    contactCountry: data.contactCountry,
                    capitalAmount: data.capitalAmount,
                    currency: data.currency,
                    fromDate: data.fromDate,
                    isItAsset: data.isItAsset,
                    additionPartyData: data.additionPartyData,
                    createdByUser: req.appCurrentUserData._id,
                }, {session: session});
                await ib.save();

                const auditData = new IbPartyAuditModel({
                    partyId: ib.partyId,
                    name: ib.name,
                    altId: ib.altId,
                    parentParty: ib.parentParty,
                    street: ib.street,
                    city: ib.city,
                    poBox: ib.poBox,
                    telephone: ib.telephone,
                    postcode: ib.postcode,
                    teleflex: ib.teleflex,
                    country: ib.country,
                    swiftAddress: ib.swiftAddress,
                    partyRole: ib.partyRole,
                    contactPersonId: ib.contactPersonId,
                    contactName: ib.contactName,
                    contactTitle: ib.contactTitle,
                    contactTelephone: ib.contactTelephone,
                    contactEmail: ib.contactEmail,
                    contactCity: ib.contactCity,
                    contactCountry: ib.contactCountry,
                    capitalAmount: ib.capitalAmount,
                    currency: ib.currency,
                    fromDate: ib.fromDate,
                    isItAsset: ib.isItAsset,
                    additionPartyData: ib.additionPartyData,
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

                callback(counter, true, 'Ib Party added successfully!', ib);

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
 * /api/v1/config/ib-party/update/{id}:
 *  put:
 *      summary: Update Ib Party by id
 *      tags: [Config-Ib Party]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Party Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          partyId:
 *                              type: string
 *                              default: AUL
 *                          name:
 *                              type: string
 *                              default: American Universal Life
 *                          altId:
 *                              type: string
 *                              default: AUL
 *                          parentParty:
 *                              type: string
 *                              default: 62abf3e623bf17b6ca8dffa3
 *                          street:
 *                              type: string
 *                              default: 423 Lithio Drive
 *                          city:
 *                              type: string
 *                              default: Indianapolis
 *                          poBox:
 *                              type: string
 *                              default: Indianapolis
 *                          telephone:
 *                              type: string
 *                              default: Indianapolis
 *                          postcode:
 *                              type: string
 *                              default: Indianapolis
 *                          teleflex:
 *                              type: string
 *                              default: Indianapolis
 *                          country:
 *                              type: string
 *                              default: US
 *                          swiftAddress:
 *                              type: string
 *                              default: Indianapolis
 *                          partyRole:
 *                              type: array
 *                              items:
 *                                  type: String
 *                              default: [Bank]
 *                          contactPersonId:
 *                              type: String
 *                              default: 1234
 *                          contactName:
 *                              type: String
 *                              default: Alan
 *                          contactTitle:
 *                              type: String
 *                              default: CEO
 *                          contactTelephone:
 *                              type: String
 *                              default: 345-987-1234
 *                          contactEmail:
 *                              type: String
 *                              default: false
 *                          contactCity:
 *                              type: String
 *                              default: false
 *                          contactCountry:
 *                              type: String
 *                              default: false
 *                          capitalAmount:
 *                              type: Number
 *                              default: 0
 *                          currency:
 *                              type: String
 *                              default: 62abf3e623bf17b6ca8dffa3
 *                          fromDate:
 *                              type: Date
 *                              default: null
 *                          isItAsset:
 *                              type: bool
 *                              default: false
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.put("/update/:id", authUser, ibPartyMiddleware.canUpdate, isValidParamId, haveDataToUpdate, (req, res) => {

    const v = new Validator(req.body, {
        partyId: 'string',
        name: 'string',
        altId: 'string',
        parentParty: 'string',
        street: 'string',
        city: 'string',
        poBox: 'string',
        telephone: 'string',
        postcode: 'string',
        teleflex: 'string',
        country: 'string',
        swiftAddress: 'string',
        partyRole: 'array',
        contactPersonId: 'string',
        contactName: 'string',
        contactTitle: 'string',
        contactTelephone: 'string',
        contactEmail: 'string',
        contactCity: 'string',
        contactCountry: 'string',
        capitalAmount: 'decimal',
        currency: 'string',
        fromDate: 'string',
        isItAsset: 'boolean',
    });

    v.check().then(async (matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missed Required fields', v.errors);
        } else {
            let session = await mongo.startSession();
            try {
                const id = req.validParamId;
                let configItem = await IbPartyModel.find({_id: id, isDeleted: false});

                if (configItem.length === 0) {
                    return br.sendNotSuccessful(res, `Ib Party with id => ${id} not found or deleted!`);
                }
                configItem = configItem[0];

                let data = {};

                if(req.body.partyId !== undefined){
                    data.partyId = req.body.partyId.toString().trim();
                }

                if(req.body.name !== undefined){
                    data.name = req.body.name.toString().trim();
                }

                if(req.body.altId !== undefined){
                    data.altId = req.body.altId.toString().trim();
                }

                if(req.body.parentParty !== undefined){

                    if(req.body.parentParty !== null && req.body.parentParty.length > 0){
                        data.parentParty = req.body.parentParty.toString().trim();

                        const parentPartyDetails = await IbPartyModel
                            .find({_id: data.parentParty, isDeleted: false,});

                        if(parentPartyDetails.length === 0){
                            return br.sendNotSuccessful(res, 'Invalid Ib Party Id => ' + data.parentParty + '!');
                        }
                    }else if(req.body.parentParty === null || req.body.parentParty.length === 0){
                        data.parentParty = null;
                    }
                }

                if(req.body.street !== undefined){
                    data.street = req.body.street.toString().trim();
                }

                if(req.body.city !== undefined){
                    data.city = req.body.city.toString().trim();
                }

                if(req.body.poBox !== undefined){
                    data.poBox = req.body.poBox.toString().trim();
                }

                if(req.body.telephone !== undefined){
                    data.telephone = req.body.telephone.toString().trim();
                }

                if(req.body.postcode !== undefined){
                    data.postcode = req.body.postcode.toString().trim();
                }

                if(req.body.teleflex !== undefined){
                    data.teleflex = req.body.teleflex.toString().trim();
                }

                if(req.body.country !== undefined){
                    data.country = req.body.country.toString().trim();
                }

                if(req.body.swiftAddress !== undefined){
                    data.swiftAddress = req.body.swiftAddress.toString().trim();
                }

                if(req.body.partyRole !== undefined && Array.isArray(req.body.partyRole)){
                    data.partyRole = req.body.partyRole;

                    if(data.partyRole.length === 0){
                        return br.sendNotSuccessful(res, 'Please add minimum one Party Role !');
                    }
                }

                if(req.body.contactPersonId !== undefined){
                    data.contactPersonId = req.body.contactPersonId.toString().trim();
                }

                if(req.body.contactName !== undefined){
                    data.contactName = req.body.contactName.toString().trim();
                }

                if(req.body.contactTitle !== undefined){
                    data.contactTitle = req.body.contactTitle.toString().trim();
                }

                if(req.body.contactTelephone !== undefined){
                    data.contactTelephone = req.body.contactTelephone.toString().trim();
                }

                if(req.body.contactEmail !== undefined){
                    data.contactEmail = req.body.contactEmail.toString().trim();
                }

                if(req.body.contactCity !== undefined){
                    data.contactCity = req.body.contactCity.toString().trim();
                }

                if(req.body.contactCountry !== undefined){
                    data.contactCountry = req.body.contactCountry.toString().trim();
                }

                if(req.body.capitalAmount !== undefined){
                    data.capitalAmount = parseInt(req.body.capitalAmount);
                }

                if(req.body.currency !== undefined){

                    if(req.body.currency !== null && req.body.currency.length > 0){
                        data.currency = req.body.currency.toString().trim();

                        const currencyDetails = await CurrencyModel
                            .find({_id: data.currency, isDeleted: false,});

                        if(currencyDetails.length === 0){
                            return br.sendNotSuccessful(res, 'Invalid Currency Id => ' + data.currency + '!');
                        }
                    }else if(req.body.currency === null || req.body.currency.length === 0){
                        data.currency = null;
                    }
                }

                if(req.body.fromDate !== undefined){
                    data.fromDate = new Date(req.body.fromDate.toString().trim());
                }

                if(req.body.isItAsset !== undefined){
                    data.isItAsset = helper.getBoolean(req.body.isItAsset);
                }


                let configFind = await IbPartyModel.find({
                    _id: {
                        $nin: id
                    },
                    partyId: data.partyId !== undefined
                        ? data.partyId
                        : configItem.partyId,
                    name: data.name !== undefined
                        ? data.name
                        : configItem.name,
                    country: data.country !== undefined
                        ? data.country
                        : configItem.country,
                });

                if (configFind.length > 0) {
                    return br.sendNotSuccessful(res, 'Ib Party is already '
                        + 'present with Party Id => `'
                        + configFind[0].partyId
                        + '` and Party Name => `'
                        + configFind[0].name
                        + '` and Country => `'
                        + configFind[0].country + '!',
                        {});
                }

                await session.startTransaction();

                data.changedByUser = req.appCurrentUserData._id;
                data.changedDate = new Date();

                await IbPartyModel.updateOne({_id: id}, data).session(session);

                let configItemDetails = await IbPartyModel.find({_id: id, isDeleted: false}).session(session);
                configItemDetails = configItemDetails[0];

                const auditData = new IbPartyAuditModel({
                    partyId: configItemDetails.partyId,
                    name: configItemDetails.name,
                    altId: configItemDetails.altId,
                    parentParty: configItemDetails.parentParty,
                    street: configItemDetails.street,
                    city: configItemDetails.city,
                    poBox: configItemDetails.poBox,
                    telephone: configItemDetails.telephone,
                    postcode: configItemDetails.postcode,
                    teleflex: configItemDetails.teleflex,
                    country: configItemDetails.country,
                    swiftAddress: configItemDetails.swiftAddress,
                    partyRole: configItemDetails.partyRole,
                    contactPersonId: configItemDetails.contactPersonId,
                    contactName: configItemDetails.contactName,
                    contactTitle: configItemDetails.contactTitle,
                    contactTelephone: configItemDetails.contactTelephone,
                    contactEmail: configItemDetails.contactEmail,
                    contactCity: configItemDetails.contactCity,
                    contactCountry: configItemDetails.contactCountry,
                    capitalAmount: configItemDetails.capitalAmount,
                    currency: configItemDetails.currency,
                    fromDate: configItemDetails.fromDate,
                    isItAsset: configItemDetails.isItAsset,
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

                br.sendSuccess(res, configItemDetails, 'Ib Party updated successfully!');

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
 * /api/v1/config/ib-party/get-demo-bulk-insert-file/csv:
 *  get:
 *      summary: Get Ib Party Insert sample csv file
 *      tags: [Config-Ib Party]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-demo-bulk-insert-file/csv", /*authUser, ib-partyMiddleware.canRead,*/ async (req, res) => {
    try {
        let csvString = json2csv([],{
            fields: [
                'partyId',
                'name',
                'altId',
                'parentParty',
                'street',
                'city',
                'poBox',
                'telephone',
                'postcode',
                'teleflex',
                'country',
                'swiftAddress',
                'partyRole',
                'contactPersonId',
                'contactName',
                'contactTitle',
                'contactTelephone',
                'contactEmail',
                'contactCity',
                'contactCountry',
                'capitalAmount',
                'currency',
                'fromDate',
                'isItAsset'
            ]
        });
        res.setHeader('Content-disposition', 'attachment; filename=configIbPartySample.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csvString);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-party/get-all:
 *  get:
 *      summary: Get all Ib Party
 *      tags: [Config-Ib Party]
 *      parameters:
 *      - name: search
 *        in: query
 *        description: Search Ib Party using Name
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, ibPartyMiddleware.canRead, async (req, res) => {
    try {
        let filter = {
            isDeleted: false,
        }

        if (req.query.search !== undefined && req.query.search.length > 0) {
            filter.name = {
                $regex: '/^' + req.query.search + '/i',
            }
        }

        let assets = await IbPartyModel.find(filter).populate(['currency', 'parentParty']);
        br.sendSuccess(res, assets);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-party/get/{id}:
 *  get:
 *      summary: get Ib Party details by id
 *      tags: [Config-Ib Party]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Party Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id", authUser, ibPartyMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await IbPartyModel.find({_id: id, isDeleted: false}).populate(['currency', 'parentParty']);

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Ib Party with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

/**
 * @swagger
 * /api/v1/config/ib-party/delete/{id}:
 *  delete:
 *      summary: delete Ib Party details by id
 *      tags: [Config-Ib Party]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Ib Party Id
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
router.delete("/delete/:id", authUser, ibPartyMiddleware.canDelete, isValidParamId, async (req, res) => {
    let session = await mongo.startSession();

    try {
        const id = req.validParamId;
        let configItemDetails = await IbPartyModel.find({_id: id, isDeleted: false});

        if (configItemDetails.length === 0) {
            return br.sendNotSuccessful(res, `Ib Party with id => ${id} not found or deleted!`);
        }

        await session.startTransaction();

        await IbPartyModel.updateOne({_id: id, isDeleted: false}, {
            isDeleted: true,
            deletedBy: req.appCurrentUserData._id,
            deleteReason: req.query.deleteReason !== undefined ? req.query.deleteReason : 'N/A'
        }).session(session);

        configItemDetails = await IbPartyModel.find({_id: id}).session(session);
        configItemDetails = configItemDetails[0];

        const auditData = new IbPartyAuditModel({
            partyId: configItemDetails.partyId,
            name: configItemDetails.name,
            altId: configItemDetails.altId,
            parentParty: configItemDetails.parentParty,
            street: configItemDetails.street,
            city: configItemDetails.city,
            poBox: configItemDetails.poBox,
            telephone: configItemDetails.telephone,
            postcode: configItemDetails.postcode,
            teleflex: configItemDetails.teleflex,
            country: configItemDetails.country,
            swiftAddress: configItemDetails.swiftAddress,
            partyRole: configItemDetails.partyRole,
            contactPersonId: configItemDetails.contactPersonId,
            contactName: configItemDetails.contactName,
            contactTitle: configItemDetails.contactTitle,
            contactTelephone: configItemDetails.contactTelephone,
            contactEmail: configItemDetails.contactEmail,
            contactCity: configItemDetails.contactCity,
            contactCountry: configItemDetails.contactCountry,
            capitalAmount: configItemDetails.capitalAmount,
            currency: configItemDetails.currency,
            fromDate: configItemDetails.fromDate,
            isItAsset: configItemDetails.isItAsset,
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

        br.sendSuccess(res, configItemDetails, 'Ib Party deleted successfully!');
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
