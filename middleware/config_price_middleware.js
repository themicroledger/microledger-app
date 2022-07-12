const helper = require('../helper/helper');

module.exports = {
    canCreate: (req, res, next) => {
        let permissionName = 'CONFIG_PRICE_CREATE';
        if (req.appCurrentUserPermissions.includes(permissionName)) {
            next();
        } else {
            helper.userNotAllowed(res, 'User is do not have ' + permissionName);
        }
    },
    canUpdate: (req, res, next) => {
        let permissionName = 'CONFIG_PRICE_EDIT';
        if (req.appCurrentUserPermissions.includes(permissionName)) {
            next();
        } else {
            helper.userNotAllowed(res, 'User is do not have ' + permissionName);
        }
    },

    canRead: (req, res, next) => {
        let permissionName = 'CONFIG_PRICE_READ';
        if (req.appCurrentUserPermissions.includes(permissionName)) {
            next();
        } else {
            helper.userNotAllowed(res, 'User is do not have ' + permissionName);
        }
    },

    canDelete: (req, res, next) => {
        let permissionName = 'CONFIG_PRICE_DELETE';
        if (req.appCurrentUserPermissions.includes(permissionName)) {
            next();
        } else {
            helper.userNotAllowed(res, 'User is do not have ' + permissionName);
        }
    },
};