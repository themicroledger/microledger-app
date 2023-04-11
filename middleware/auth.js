const mongo = require('mongoose');
const helper = require("../helper/helper");
const logger = require('./../helper/logger');
const UserModel = require('../models/userModel');
const br = helper.baseResponse;

const authUser = (req, res, next) => {
  try {
    if(!req.headers.authorization) {
      return res.status(401).send(br.withError("Authentication failed"));
    }
    const token = req.headers.authorization.split(" ")[1];
    helper.verifyToken(token,(err, data) => {
      if(err){
        console.log('Unauthenticated token!');
        logger.info('Unauthenticated token!');
        res.status(401).send(br.withError('Authentication failed'));
      }else{

        UserModel
            .aggregate([{
                $match: {
                    email: data.email,
                }
            }, {
                $lookup: {
                    from: 'user_roles',
                    localField: 'roles',
                    foreignField: 'name',
                    as: 'roleDetails',
                    pipeline: [{
                        $lookup: {
                            from: 'user_role_permissions',
                            localField: 'permissions',
                            foreignField: '_id',
                            as: 'eligiblePermissions'
                        }
                    }]
                }
            }, {
                $project: {
                    _id: 1,
                    name: 1,
                    email: 1,
                    phoneNumber: 1,
                    profilePicUrl: 1,
                    dob: 1,
                    gender: 1,
                    permissions: '$roleDetails.eligiblePermissions.name'
                }
            }])
            .then((userData) => {
              //userData.password = '';
              if(userData.length > 0){
                userData = userData[0];

                let permissions = [];
                userData.permissions.forEach( el => {
                    el.forEach( name => {
                        if(permissions.findIndex( l => l === name ) === -1){
                            permissions.push(name);
                        }
                    });
                });
                req.appCurrentUserData = userData;
                req.appCurrentUserPermissions = permissions;
                next();
              }
              else{
                logger.error('Unable to authenticate user as user not found which present in jwt => ' + token);
                br.sendError(res, {}, 'Auth Error Bug', 401);
              }
        }).catch((e) => {
          logger.error('Db Error on Middleware Auth => ' + e.toString());
          br.sendDatabaseError(res, e);
        });
      }
    });
  } catch (error) {
    console.log(error);
    logger.error(error);
    br.sendServerError(res, {});
  }
};

const haveDataToUpdate = (req, res, next) => {
    if(Object.keys(req.body).length === 0){
        return br.sendNotSuccessful(res, 'Nothing to update!');
    }else{
        next();
    }
}

const isValidParamId = (req, res, next) => {
    const id = req.params.id;

    if(helper.isValidObjectId(id)){
        req.validParamId = id;
        next();
    }else{
        return br.sendNotSuccessful(res, 'Please enter a valid id!');
    }
}

module.exports = {
    authUser,
    isValidParamId,
    haveDataToUpdate
}