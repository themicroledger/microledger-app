const express = require("express");
const mongo = require("mongoose");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const moment = require('moment');
const br = helper.baseResponse;
const router = new express.Router();
const {bulkUploader, bondAttachUploader} = require('../helper/file_uploader');
const SecurityGroupModel = require('../../../models/configSecurityGroupModel');
const CurrencyModel = require('../../../models/configCurrencyModel');
const CalenderOrBankHolidayModel = require('../../../models/configCalenderOrBankHolidayModel');
const IbExchangeModel = require('../../../models/configIbExchangeModel');
const IbQuote = require('../../../models/configIbQuoteModel');
const IbParty = require('../../../models/configIbPartyModel');
const IbInterestType = require('../../../models/configIbInterestTypeModel');
const ReferenceRateModel = require('../../../models/configReferenceRatesDescriptionModel');
const BondSecurityModel = require('../../../models/bondSecurityModel');
const BondSecurityAuditModel = require('../../../models/bondSecurityAuditModel');
const {Validator} = require('node-input-validator');
const json2csv = require('json2csv').parse;
const {processBulkInsert} = require('../helper/process_bulk_insert');
const {authUser, isValidParamId} = require('../../../middleware/auth');
const bondSecurityMiddleware = require('../../../middleware/bond_security_middleware');

/**
 * @swagger
 * /api/v1/audit/get-all:
 *  get:
 *      summary: Get all Audits
 *      tags: [Audit]
 *      parameters:
 *      - name: auditType
 *        in: query
 *        description: Audit Type
 *        default: bond
 *      - name: auditedUser
 *        in: query
 *        description: User id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      - name: page
 *        in: query
 *        description: Current page number
 *        default: 1
 *      - name: perPage
 *        in: query
 *        description: Items per page
 *        default: 20
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get-all", authUser, bondSecurityMiddleware.canRead, async (req, res) => {
    try {
        let allAudits = [
            "config_ab_framework_audits",
            "config_accounting_calender_audits",
            "config_accounting_period_definition_audits",
            "config_accounting_treatment_lookup_audits",
            "config_calender_or_bank_holiday_rule_audits",
            "config_company_portfolio_audits",
            "config_cost_basis_rule_audits",
            "config_currency_audits",
            "config_ib_asset_class_audits",
            "config_ib_company_audits",
            "config_ib_exchange_audits",
            "config_ib_interest_type_audits",
            "config_ib_party_audits",
            "config_ib_quote_audits",
            "config_ib_structure_audits",
            "config_ib_transaction_status_audits",
            "config_ledger_lookup_audits",
            "config_ledger_period_control_audits",
            "config_portfolio_group_audits",
            "config_portfolio_type_audits",
            "config_price_audits",
            "config_reference_rates_description_audits",
            "config_rounding_table_audits",
            "config_security_group_audits",
            "config_transaction_code_audits"
        ];

        let pipeline = [
            {
                '$addFields': {
                    'collectionName': 'bond_security_audits'
                }
            }
        ];
        if (helper.isValidObjectId(req.params.auditedUser)) {
            pipeline.push({
                '$match': {
                    'actionBy': req.params.auditedUser
                }
            });
        }

        allAudits.forEach((au) => {
            let filterPipeline = [
                {
                    '$addFields': {
                        'collectionName': au
                    }
                }
            ];
            if (helper.isValidObjectId(req.params.auditedUser)) {
                filterPipeline.push({
                    '$match': {
                        'actionBy': req.params.auditedUser
                    }
                });
            }
            pipeline.push({
                '$unionWith': {
                    'coll': au,
                    'pipeline': filterPipeline
                }
            });
        });

/*        if (req.query.searchKey !== undefined && eligibleSearchKeys.includes(req.query.searchKey.toString())) {
            let searchKey = req.query.searchKey.toString();
            let searchData = req.query.search !== undefined ? req.query.search.toString() : '';
            logger.info(`SearchKey: ${req.query.searchKey} => ${req.query.search}`);

            filter[searchKey] = {
                $regex: '/^' + searchData + '/i',
            }
        }*/

        /*        if (req.query.search !== undefined && req.query.search.length > 0) {
                    filter.costBasisProfileName = {
                        $regex: '/^' + req.query.search + '/i',
                    }
                }*/
        let result = {
            total: 0,
            perPage: 20,
            from: 0,
            to: 0,
            lastPage: null,
            nextPage: null,
            currentPage: 1,
            data: []
        };

        if (parseInt(req.query.perPage) > 0) {
            result.perPage = parseInt(req.query.perPage);
        }

        if (parseInt(req.query.page) > 0) {
            result.currentPage = parseInt(req.query.page);
        }

        console.log(JSON.stringify(pipeline));
        result.total = await BondSecurityModel.aggregate([...pipeline, {
            '$count': 'count'
        }]);
        result.total = result.total[0].count;

        pipeline.push({
            '$sort': {
                'actionDate': -1
            }
        });
        let lp = Math.ceil(result.total / result.perPage);
        let offset = (result.currentPage - 1) * result.perPage;
        result.lastPage = lp > 1 ? lp : null;
        result.nextPage = result.total > (result.perPage * result.currentPage) ? result.currentPage + 1 : null;
        result.data = await BondSecurityModel.aggregate([...pipeline, {
            '$skip': offset
        }, {
            '$limit': result.perPage
        }]);
/*        if (result.total <= (result.currentPage * result.perPage)) {
            result.data = await BondSecurityModel.aggregate(pipeline);
        }*/

        result.from = offset + 1;
        result.to = offset + result.data.length;

        br.sendSuccess(res, result);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});


/**
 * @swagger
 * /api/v1/audit/get/{id}/{auditType}:
 *  get:
 *      summary: get Audit by id and auditType
 *      tags: [Audit]
 *      parameters:
 *      - name: id
 *        in: path
 *        description: Bond Security Id
 *        default: 6287f9cc5f9120bbbbc36f59
 *      - name: auditType
 *        in: path
 *        description: AuditType
 *        default: bond
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/get/:id/:auditType", authUser, bondSecurityMiddleware.canRead, isValidParamId, async (req, res) => {
    try {
        const id = req.validParamId;
        let assetDetails = await BondSecurityModel
            .find({_id: id, isDeleted: false})
            .populate([
                'securityCode',
                'currency',
                'paymentHolidayCalender',
                'exchange',
                'quoted',
                'issuer',
                'redemptionCurrency',
                'interestType',
                'structure'
            ]);

        if (assetDetails.length === 0) {
            return br.sendNotSuccessful(res, `Bond Security with id => ${id} not found or deleted!`);
        }

        br.sendSuccess(res, assetDetails[0]);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

module.exports = router;
