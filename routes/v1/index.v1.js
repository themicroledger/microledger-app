module.exports = (app) => {
    app.use('/api/v1/auth', require('./auth'));
    app.use('/api/v1/user', require('./users/users'));
    app.use('/api/v1/common', require('./helper/common'));
    app.use('/api/v1/user-role', require('./roles_and_permissions/roles_and_permissions'));

    app.use('/api/v1/config/ib-assets', require('./configs/config_ib_assets'));
    app.use('/api/v1/config/ib-structure', require('./configs/config_ib_structure'));
    app.use('/api/v1/config/ib-interest-type', require('./configs/config_ib_interest_type'));
    app.use('/api/v1/config/portfolio-type', require('./configs/config_portfolio_type'));
    app.use('/api/v1/config/ib-quote', require('./configs/config_ib_quote'));
    app.use('/api/v1/config/security-group', require('./configs/config_security_group'));
    app.use('/api/v1/config/ib-transaction-status', require('./configs/config_ib_transaction_status'));
    app.use('/api/v1/config/cost-basis-rule', require('./configs/config_cost_basis_rule'));

    app.use('/api/v1/config/calender-or-bank-holiday', require('./configs/config_calender_or_bank_holiday'));
    app.use('/api/v1/config/currency', require('./configs/config_currency'));
    app.use('/api/v1/config/ib-party', require('./configs/config_ib_party'));
    app.use('/api/v1/config/ab-framework', require('./configs/config_ab_framework'));
    app.use('/api/v1/config/company-portfolio', require('./configs/config_company_portfolio'));
    app.use('/api/v1/config/portfolio-group', require('./configs/config_portfolio_group'));
    app.use('/api/v1/config/ib-company', require('./configs/config_ib_company'));
    app.use('/api/v1/config/reference-rate-description', require('./configs/config_reference_rate_description'));
    app.use('/api/v1/config/price', require('./configs/config_price'));
    app.use('/api/v1/config/rounding-table', require('./configs/config_rounding_table'));
    app.use('/api/v1/config/transaction-code', require('./configs/config_transaction_code'));
    app.use('/api/v1/config/ib-exchange', require('./configs/config_ib_exchange'));
    app.use('/api/v1/config/accounting-calender', require('./configs/config_accounting_calender'));
    app.use('/api/v1/config/ledger-lookup', require('./configs/config_ledger_lookup'));
    app.use('/api/v1/config/accounting-treatment-lookup', require('./configs/config_accounting_treatment_lookup'));
    app.use('/api/v1/config/accounting-period-definition', require('./configs/config_accounting_period_definition'));
    app.use('/api/v1/config/ledger-period-control', require('./configs/config_ledger_period_control'));
    app.use('/api/v1/bond', require('./bond/bond_security'));
}