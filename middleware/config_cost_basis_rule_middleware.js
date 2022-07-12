const helper = require('../helper/helper');

module.exports = {
    canCreate: (req, res, next) => {
        let permissionName = 'CONFIG_COST_BASIS_RULE_CREATE';
        if (req.appCurrentUserPermissions.includes(permissionName)) {
            next();
        } else {
            helper.userNotAllowed(res, 'User is do not have ' + permissionName);
        }
    },
    canUpdate: (req, res, next) => {
        let permissionName = 'CONFIG_COST_BASIS_RULE_EDIT';
        if (req.appCurrentUserPermissions.includes(permissionName)) {
            next();
        } else {
            helper.userNotAllowed(res, 'User is do not have ' + permissionName);
        }
    },

    canRead: (req, res, next) => {
        let permissionName = 'CONFIG_COST_BASIS_RULE_READ';
        if (req.appCurrentUserPermissions.includes(permissionName)) {
            next();
        } else {
            helper.userNotAllowed(res, 'User is do not have ' + permissionName);
        }
    },

    canDelete: (req, res, next) => {
        let permissionName = 'CONFIG_COST_BASIS_RULE_DELETE';
        if (req.appCurrentUserPermissions.includes(permissionName)) {
            next();
        } else {
            helper.userNotAllowed(res, 'User is do not have ' + permissionName);
        }
    },
};