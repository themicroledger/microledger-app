const express = require("express");
const RoleModel = require("../../../models/roleModel");
const PermissionModel = require("../../../models/permissionModel");
const helper = require("../../../helper/helper");
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const accessTypes = helper.sysConst.permissionAccessTypes;
const allPer = {
    user: [
        {name: 'USER_CREATE', accessType: accessTypes.CREATE},
        {name: 'USER_READ', accessType: accessTypes.READ},
        {name: 'USER_EDIT', accessType: accessTypes.EDIT},
        {name: 'USER_DELETE', accessType: accessTypes.DELETE},
    ],
    configIbAssetClass: [
        {name: 'CONFIG_IB_ASSET_CLASS_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_IB_ASSET_CLASS_READ', accessType: accessTypes.READ},
        {name: 'CONFIG_IB_ASSET_CLASS_EDIT', accessType: accessTypes.EDIT},
        {name: 'CONFIG_IB_ASSET_CLASS_DELETE', accessType: accessTypes.DELETE},
    ],
    configIbStructure: [
        {name: 'CONFIG_IB_STRUCTURE_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_IB_STRUCTURE_READ', accessType: accessTypes.READ},
        {name: 'CONFIG_IB_STRUCTURE_EDIT', accessType: accessTypes.EDIT},
        {name: 'CONFIG_IB_STRUCTURE_DELETE', accessType: accessTypes.DELETE,},
    ],
    configIbInterestType: [
        {name: 'CONFIG_IB_INTEREST_TYPE_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_IB_INTEREST_TYPE_READ', accessType: accessTypes.READ},
        {name: 'CONFIG_IB_INTEREST_TYPE_EDIT', accessType: accessTypes.EDIT},
        {name: 'CONFIG_IB_INTEREST_TYPE_DELETE', accessType: accessTypes.DELETE,},
    ],
    configPortfolio: [
        {name: 'CONFIG_PORTFOLIO_TYPE_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_PORTFOLIO_TYPE_READ', accessType: accessTypes.READ},
        {name: 'CONFIG_PORTFOLIO_TYPE_EDIT', accessType: accessTypes.EDIT},
        {name: 'CONFIG_PORTFOLIO_TYPE_DELETE', accessType: accessTypes.DELETE,}
    ],
    configIbQuote: [
        {name: 'CONFIG_IB_QUOTES_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_IB_QUOTES_READ', accessType: accessTypes.READ},
        {name: 'CONFIG_IB_QUOTES_EDIT', accessType: accessTypes.EDIT},
        {name: 'CONFIG_IB_QUOTES_DELETE', accessType: accessTypes.DELETE,}
    ],
    configSecurityGroup: [
        {name: 'CONFIG_SECURITY_GROUP_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_SECURITY_GROUP_READ', accessType: accessTypes.READ},
        {name: 'CONFIG_SECURITY_GROUP_EDIT', accessType: accessTypes.EDIT},
        {name: 'CONFIG_SECURITY_GROUP_DELETE', accessType: accessTypes.DELETE,}
    ],
    configIbTransactionStatus: [
        {name: 'CONFIG_IB_TRANSACTION_STATUS_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_IB_TRANSACTION_STATUS_READ', accessType: accessTypes.READ},
        {name: 'CONFIG_IB_TRANSACTION_STATUS_EDIT', accessType: accessTypes.EDIT},
        {name: 'CONFIG_IB_TRANSACTION_STATUS_DELETE', accessType: accessTypes.DELETE,}
    ],
    configCostBasisRule: [
        {name: 'CONFIG_COST_BASIS_RULE_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_COST_BASIS_RULE_READ', accessType: accessTypes.READ},
        {name: 'CONFIG_COST_BASIS_RULE_EDIT', accessType: accessTypes.EDIT},
        {name: 'CONFIG_COST_BASIS_RULE_DELETE', accessType: accessTypes.DELETE,}
    ],
    configCalenderOrBankHoliday: [
        {name: 'CONFIG_CALENDER_OR_BANK_HOLIDAY_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_CALENDER_OR_BANK_HOLIDAY_READ', accessType: accessTypes.READ},
        {name: 'CONFIG_CALENDER_OR_BANK_HOLIDAY_EDIT', accessType: accessTypes.EDIT},
        {name: 'CONFIG_CALENDER_OR_BANK_HOLIDAY_DELETE', accessType: accessTypes.DELETE,}
    ],
    configCurrency: [
        {name: 'CONFIG_CURRENCY_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_CURRENCY_READ', accessType: accessTypes.READ},
        {name: 'CONFIG_CURRENCY_EDIT', accessType: accessTypes.EDIT},
        {name: 'CONFIG_CURRENCY_DELETE', accessType: accessTypes.DELETE,}
    ],
    configIbParty: [
        {name: 'CONFIG_IB_PARTY_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_IB_PARTY_READ', accessType: accessTypes.READ},
        {name: 'CONFIG_IB_PARTY_EDIT', accessType: accessTypes.EDIT},
        {name: 'CONFIG_IB_PARTY_DELETE', accessType: accessTypes.DELETE,}
    ],
    configAbFramework: [
        {name: 'CONFIG_AB_FRAMEWORK_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_AB_FRAMEWORK_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_AB_FRAMEWORK_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_AB_FRAMEWORK_DELETE', accessType: accessTypes.DELETE,}
    ],
    configCompanyPortfolio: [
        {name: 'CONFIG_COMPANY_PORTFOLIO_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_COMPANY_PORTFOLIO_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_COMPANY_PORTFOLIO_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_COMPANY_PORTFOLIO_DELETE', accessType: accessTypes.DELETE,}
    ],
    configPortfolioGroup: [
        {name: 'CONFIG_PORTFOLIO_GROUP_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_PORTFOLIO_GROUP_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_PORTFOLIO_GROUP_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_PORTFOLIO_GROUP_DELETE', accessType: accessTypes.DELETE,}
    ],
    configIbCompany: [
        {name: 'CONFIG_IB_COMPANY_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_IB_COMPANY_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_IB_COMPANY_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_IB_COMPANY_DELETE', accessType: accessTypes.DELETE,}
    ],
    configReferenceRatesDescription: [
        {name: 'CONFIG_REFERENCE_RATES_DESCRIPTION_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_REFERENCE_RATES_DESCRIPTION_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_REFERENCE_RATES_DESCRIPTION_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_REFERENCE_RATES_DESCRIPTION_DELETE', accessType: accessTypes.DELETE,}
    ],
    configPrice: [
        {name: 'CONFIG_PRICE_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_PRICE_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_PRICE_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_PRICE_DELETE', accessType: accessTypes.DELETE,}
    ],
    configRoundingTable: [
        {name: 'CONFIG_ROUNDING_TABLE_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_ROUNDING_TABLE_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_ROUNDING_TABLE_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_ROUNDING_TABLE_DELETE', accessType: accessTypes.DELETE,}
    ],
    configTransactionCode: [
        {name: 'CONFIG_TRANSACTION_CODE_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_TRANSACTION_CODE_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_TRANSACTION_CODE_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_TRANSACTION_CODE_DELETE', accessType: accessTypes.DELETE,}
    ],
    configIbExchange: [
        {name: 'CONFIG_IB_EXCHANGE_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_IB_EXCHANGE_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_IB_EXCHANGE_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_IB_EXCHANGE_DELETE', accessType: accessTypes.DELETE,}
    ],
    configAccountingCalender: [
        {name: 'CONFIG_ACCOUNTING_CALENDER_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_ACCOUNTING_CALENDER_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_ACCOUNTING_CALENDER_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_ACCOUNTING_CALENDER_DELETE', accessType: accessTypes.DELETE,}
    ],
    configLedgerLookup: [
        {name: 'CONFIG_LEDGER_LOOKUP_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_LEDGER_LOOKUP_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_LEDGER_LOOKUP_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_LEDGER_LOOKUP_DELETE', accessType: accessTypes.DELETE,}
    ],
    configAccountingTreatmentLookup: [
        {name: 'CONFIG_ACCOUNTING_TREATMENT_LOOKUP_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_ACCOUNTING_TREATMENT_LOOKUP_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_ACCOUNTING_TREATMENT_LOOKUP_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_ACCOUNTING_TREATMENT_LOOKUP_DELETE', accessType: accessTypes.DELETE,}
    ],
    configAccountingPeriodDefinition: [
        {name: 'CONFIG_ACCOUNTING_PERIOD_DEFINITION_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_ACCOUNTING_PERIOD_DEFINITION_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_ACCOUNTING_PERIOD_DEFINITION_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_ACCOUNTING_PERIOD_DEFINITION_DELETE', accessType: accessTypes.DELETE,}
    ],
    configLedgerPeriodControl: [
        {name: 'CONFIG_LEDGER_PERIOD_CONTROL_CREATE', accessType: accessTypes.CREATE},
        {name: 'CONFIG_LEDGER_PERIOD_CONTROL_EDIT', accessType: accessTypes.READ},
        {name: 'CONFIG_LEDGER_PERIOD_CONTROL_READ', accessType: accessTypes.EDIT},
        {name: 'CONFIG_LEDGER_PERIOD_CONTROL_DELETE', accessType: accessTypes.DELETE,}
    ],
   bondSecurity: [
        {name: 'BOND_SECURITY_CREATE', accessType: accessTypes.CREATE},
        {name: 'BOND_SECURITY_EDIT', accessType: accessTypes.READ},
        {name: 'BOND_SECURITY_READ', accessType: accessTypes.EDIT},
        {name: 'BOND_SECURITY_DELETE', accessType: accessTypes.DELETE,}
    ]
};

/**
 * @swagger
 * /api/v1/user-role/seed:
 *  get:
 *      summary: Seed
 *      tags: [User-Role]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/seed", async (req, res) => {

    try {
        await RoleModel.deleteMany({});
        await PermissionModel.deleteMany({});


        let allPermissions = await PermissionModel.insertMany([
            ...allPer.user,
            ...allPer.configIbAssetClass,
            ...allPer.configIbStructure,
            ...allPer.configIbInterestType,
            ...allPer.configPortfolio,
            ...allPer.configIbQuote,
            ...allPer.configSecurityGroup,
            ...allPer.configIbTransactionStatus,
            ...allPer.configCostBasisRule,
            ...allPer.configCalenderOrBankHoliday,
            ...allPer.configCurrency,
            ...allPer.configIbParty,
            ...allPer.configAbFramework,
            ...allPer.configCompanyPortfolio,
            ...allPer.configPortfolioGroup,
            ...allPer.configIbCompany,
            ...allPer.configReferenceRatesDescription,
            ...allPer.configPrice,
            ...allPer.configRoundingTable,
            ...allPer.configTransactionCode,
            ...allPer.configIbExchange,
            ...allPer.configAccountingCalender,
            ...allPer.configLedgerLookup,
            ...allPer.configAccountingTreatmentLookup,
            ...allPer.configAccountingPeriodDefinition,
            ...allPer.configLedgerPeriodControl,
            ...allPer.bondSecurity
        ]);

        let allPermissionIds = [], userPermissionIds = [];

        allPermissions.forEach((permission) => {
            allPermissionIds.push(permission._id);
            if (permission.name.match(/^config/i) && [accessTypes.CREATE, accessTypes.READ, accessTypes.EDIT].includes(permission.accessType)) {
                userPermissionIds.push(permission._id);
            }
        })

        await RoleModel.insertMany([
            {
                name: 'SUPER_ADMIN',
                permissions: allPermissionIds,
            },
            {
                name: 'DATA_ENTRY',
                permissions: userPermissionIds
            }
        ]);

        res.send(helper.baseResponse.withSuccess('Roles & Permissions seed completed', {}));
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});


module.exports = router;
