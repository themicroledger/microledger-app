const express = require("express");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const BondSecurityModel = require('../../../models/bondSecurityModel');
const BondSecurityAuditModel = require('../../../models/bondSecurityAuditModel');
const {authUser, isValidParamId} = require('../../../middleware/auth');
const bondSecurityMiddleware = require('../../../middleware/bond_security_middleware');

/**
 * @swagger
 * /api/v1/audit/get-all:
 *  get:
 *      summary: Get all Audits
 *      tags: [Audit]
 *      parameters:
 *      - name: auditFor
 *        in: query
 *        description: Audit For Table name
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
            {
                searchFilter: "Ab Framework",
                tableName: "config_ab_framework_audits"
            },
            {
                searchFilter: "Accounting Calender",
                tableName: "config_accounting_calender_audits"
            },
            {
                searchFilter: "Accounting Period Definition",
                tableName: "config_accounting_period_definition_audits"
            },
            {
                searchFilter: "Accounting Treatment Lookup",
                tableName: "config_accounting_treatment_lookup_audits"
            },
            {
                searchFilter: "Calender Or Bank Holiday Rule",
                tableName: "config_calender_or_bank_holiday_rule_audits"
            },
            {
                searchFilter: "Company Portfolio",
                tableName: "config_company_portfolio_audits"
            },
            {
                searchFilter: "Cost Basis Rule",
                tableName: "config_cost_basis_rule_audits"
            },
            {
                searchFilter: "Currency",
                tableName: "config_currency_audits"
            },
            {
                searchFilter: "Ib Asset Class",
                tableName: "config_ib_asset_class_audits"
            },
            {
                searchFilter: "Ib Company",
                tableName: "config_ib_company_audits"
            },
            {
                searchFilter: "Ib Exchange",
                tableName: "config_ib_exchange_audits"
            },
            {
                searchFilter: "Ib Interest Type",
                tableName: "config_ib_interest_type_audits"
            },
            {
                searchFilter: "Ib Party",
                tableName: "config_ib_party_audits"
            },
            {
                searchFilter: "Ib Quote",
                tableName: "config_ib_quote_audits"
            },
            {
                searchFilter: "Ib Structure",
                tableName: "config_ib_structure_audits"
            },
            {
                searchFilter: "Ib Transaction Status",
                tableName: "config_ib_transaction_status_audits"
            },
            {
                searchFilter: "Ledger Lookup",
                tableName: "config_ledger_lookup_audits"
            },
            {
                searchFilter: "Ledger Period Control",
                tableName: "config_ledger_period_control_audits"
            },
            {
                searchFilter: "Portfolio Group",
                tableName: "config_portfolio_group_audits"
            },
            {
                searchFilter: "Portfolio Type",
                tableName: "config_portfolio_type_audits"
            },
            {
                searchFilter: "Price",
                tableName: "config_price_audits"
            },
            {
                searchFilter: "Reference Rates Description",
                tableName: "config_reference_rates_description_audits"
            },
            {
                searchFilter: "Rounding Table",
                tableName: "config_rounding_table_audits"
            },
            {
                searchFilter: "Security Group",
                tableName: "config_security_group_audits"
            },
            {
                searchFilter: "Transaction Code",
                tableName: "config_transaction_code_audits"
            },
            {
                searchFilter: "Bond",
                tableName: "bond_securities"
            }
        ];
        let searchFilters = allAudits.map(a => a.searchFilter.toLowerCase());
        let excludeBondItems = false;

        if(req.query.auditFor !== undefined && req.query.auditFor !== null && req.query.auditFor.length > 0){
            let searchItems = req.query.auditFor.split(',');
            let needToFilterItems = searchFilters.filter( a => searchItems.includes(a.toString().toLowerCase()));
            searchFilters = needToFilterItems.length > 0 ? needToFilterItems : searchFilters;
            excludeBondItems = searchFilters.includes('bond');
        }

        let pipeline = [
            {
                '$addFields': {
                    'collectionName': 'Bond'
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

        console.log(searchFilters);
        allAudits.forEach((au) => {
            if(searchFilters.includes(au.searchFilter) && au.searchFilter !== 'bond'){
                let filterPipeline = [
                    {
                        '$addFields': {
                            'collectionName': au.searchFilter
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
                        'coll': au.tableName,
                        'pipeline': filterPipeline
                    }
                });
            }
        });

        //exclude bond items
        if(excludeBondItems){
            pipeline.push({
                $match : {
                    collectionName: {
                        $nin : [ 'Bond' ]
                    }
                }
            });
        }

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
        result.total = await BondSecurityAuditModel.aggregate([...pipeline, {
            '$count': 'count'
        }]);
        console.log(result);
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
        result.data = await BondSecurityAuditModel.aggregate([...pipeline, {
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
        console.log(error);
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
