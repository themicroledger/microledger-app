const express = require("express");
const crypto = require('crypto');
const bcrypt = require("bcrypt");
const UserModel = require("../../models/userModel");
const sendEmail = require("../../helper/email/sendEmail");
const ResetTokenModel = require("../../models/resetTokenModel");
const helper = require("../../helper/helper");
const logger = require('../../helper/logger');
const {Validator} = require("node-input-validator");
const br = helper.baseResponse;
const router = new express.Router();
const bcryptSalt = process.env.BCRYPT_SALT;

/**
 * @swagger
 * /api/v1/auth/login:
 *  post:
 *      summary: Login api
 *      tags: [Auth]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          email:
 *                              type: string
 *                              default: admin@gmail.com
 *                          password:
 *                              type: string
 *                              default: admin
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/login", (req, res) => {
    try {
        const v = new Validator(req.body, {
            email: 'required|email',
            password: 'required|string'
        });

        v.check().then(async (matched) => {
            if (!matched) {
                br.sendNotSuccessful(res, 'validation Error', v.errors);
            } else {
                const loginUser = await UserModel.find({email: req.body.email, isDeleted: false}).populate('password');

                if (loginUser < 1) {
                    br.sendNotSuccessful(res, 'User not found!');
                } else {

                    const cmp = await bcrypt.compare(req.body.password, loginUser[0].password);
                    if (cmp) {
                        const token = helper.generateToken({
                            email: loginUser[0].email
                        });
                        await UserModel.updateOne({_id: loginUser[0]._id}, {
                            lastLoggedIn: new Date(),
                        });
                        br.sendSuccess(res, {
                            userData: {
                                id: loginUser[0]._id,
                                name: loginUser[0].name,
                                email: loginUser[0].email,
                                profilePicUrl: loginUser[0].profilePicUrl,
                                dob: loginUser[0].dob,
                                gender: loginUser[0].gender,
                                roles: loginUser[0].roles,
                                isVerified: loginUser[0].isVerified,
                            },
                            token: token
                        }, 'Login successful');
                    } else {
                        br.sendNotSuccessful(res, 'Incorrect user password!');
                    }
                }
            }
        });
    } catch (error) {
        logger.error(error);
        br.serverError(error, res);
    }
});

/**
 * @swagger
 * /api/v1/auth/reset/send-reset-link:
 *  post:
 *      summary: Send reset link to registered email address
 *      tags: [Auth]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          email:
 *                              type: string
 *                              default: admin@gmail.com
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/reset/send-reset-link", (req, res) => {
    const v = new Validator(req.body, {
        email: 'required|email',
    });

    v.check().then((matched) => {
        if (!matched) {
            res.status(422).send(br.withError('Please enter a valid email address!', v.errors));
        } else {
            UserModel.find({email: req.body.email, isDeleted: false}).then((userDetails) => {
                if (userDetails.length < 1) {
                    br.sendNotSuccessful(res, 'User not found!');
                } else {
                    userDetails = userDetails[0];
                    ResetTokenModel.updateMany({
                        expiredAt: {$gt: new Date()},
                        userId: userDetails._id
                    }, {expiredAt: new Date()}).then(result => {
                        console.log(result);
                        let resetToken = crypto.randomBytes(32).toString("hex");
                        bcrypt.hash(resetToken, Number(bcryptSalt)).then(async (hash, err) => {
                            if (err) {
                                logger.error(err);
                                logger.error('Unable to generate reset token UserId => ' + userDetails._id.toString());
                                br.sendError(res, {}, 'Unable to generate reset link! Please try again later!');
                            } else {
                                let resetTokenData = await new ResetTokenModel({
                                    userId: userDetails._id,
                                    token: hash,
                                    expiredAt: new Date(Date.now() + (4 * 1000 * 3600)),
                                    createdAt: Date.now(),
                                }).save();
                                let clientURL = process.env[`APP_HOME_URL_${process.env.APP_ENV_MODE}`];
                                let link = `${clientURL}resetPass?token=${resetToken}&id=${resetTokenData._id}`;
                                await sendEmail.sendPasswordResetEmail(userDetails.email, link);
                                br.sendSuccess(res, {}, 'Email sent to you email ' + userDetails.email);
                            }
                        }).catch(err => {
                            logger.error(err);
                            logger.error('Unable to generate reset token UserId => ' + userDetails._id.toString());
                            br.sendError(res, {}, 'Unable to generate reset token!');
                        });
                    }).catch(err => {
                        logger.error(err);
                        br.sendDatabaseError(res, {});
                    });
                }
            }).catch(err => {
                logger.error(err);
                br.sendDatabaseError(res, {});
            });
        }
    });
});

/**
 * @swagger
 * /api/v1/auth/verify/email:
 *  post:
 *      summary: Check reset link is valid or not
 *      tags: [Auth]
 *      parameters:
 *      - name: verifyToken
 *        in: query
 *        description: Token to be verified!
 *        default: bo
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/verify/email", (req, res) => {
    const v = new Validator(req.body, {
        token: 'required|string',
        id: 'required|string',
    });

    v.check().then((matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Invalid token details', v.errors);
        } else {
            let {id, token} = req.body;

            if (!helper.isValidObjectId(id)) {
                return br.sendNotSuccessful(res, 'Invalid Token Id');
            }

            ResetTokenModel.findById(id).then((tokenDetails) => {
                if (tokenDetails !== null) {
                    bcrypt.compare(token, tokenDetails.token, (rejected, accepted) => {
                        if (accepted) {
                            if (tokenDetails.expiredAt > new Date()) {
                                br.sendSuccess(res, {}, 'Please try to reset your password!');
                            } else {
                                br.sendNotSuccessful(res, 'Token Expired');
                            }
                        } else {
                            return br.sendNotSuccessful(res, 'Invalid token data');
                        }
                    });
                } else {
                    return br.sendNotSuccessful(res, 'Anonymous Token details!')
                }
            }).catch(err => {
                br.sendDatabaseError(res, err);
            });
        }
    });
});

/**
 * @swagger
 * /api/v1/auth/reset/check-reset-link-valid:
 *  post:
 *      summary: Check reset link is valid or not
 *      tags: [Auth]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          token:
 *                              type: string
 *                              default: admin@gmail.com
 *                          id:
 *                              type: string
 *                              default: admin@gmail.com
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/reset/check-reset-link-valid", (req, res) => {
    const v = new Validator(req.body, {
        token: 'required|string',
        id: 'required|string',
    });

    v.check().then((matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Invalid token details', v.errors);
        } else {
            let {id, token} = req.body;

            if (!helper.isValidObjectId(id)) {
                return br.sendNotSuccessful(res, 'Invalid Token Id');
            }

            ResetTokenModel.findById(id).then((tokenDetails) => {
                if (tokenDetails !== null) {
                    bcrypt.compare(token, tokenDetails.token, (rejected, accepted) => {
                        if (accepted) {
                            if (tokenDetails.expiredAt > new Date()) {
                                br.sendSuccess(res, {}, 'Please try to reset your password!');
                            } else {
                                br.sendNotSuccessful(res, 'Token Expired');
                            }
                        } else {
                            return br.sendNotSuccessful(res, 'Invalid token data');
                        }
                    });
                } else {
                    return br.sendNotSuccessful(res, 'Anonymous Token details!')
                }
            }).catch(err => {
                br.sendDatabaseError(res, err);
            });
        }
    });
});

/**
 * @swagger
 * /api/v1/auth/reset/reset-password:
 *  post:
 *      summary: Check reset link is valid or not
 *      tags: [Auth]
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          password:
 *                              type: string
 *                              default: password
 *                          confirmPassword:
 *                              type: string
 *                              default: password
 *                          token:
 *                              type: string
 *                              default: admin@gmail.com
 *                          id:
 *                              type: string
 *                              default: admin@gmail.com
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.post("/reset/reset-password", (req, res) => {
    const v = new Validator(req.body, {
        password: 'required|string|minLength:5|maxLength:16',
        confirmPassword: 'required|string|minLength:5|maxLength:16',
        token: 'required|string',
        id: 'required|string',
    });

    v.check().then((matched) => {
        if (!matched) {
            br.sendNotSuccessful(res, 'Missing required fields!', v.errors);
        } else {
            let {password, confirmPassword, id, token} = req.body;

            if (!helper.isValidObjectId(id)) {
                return br.sendNotSuccessful(res, 'Invalid Token Id');
            }

            if (password !== confirmPassword) {
                return br.sendNotSuccessful(res, 'password and confirmPassword did not matched!');
            }

            ResetTokenModel.find({_id: id}).then((tokenDetails) => {
                if (tokenDetails.length === 1) {
                    tokenDetails = tokenDetails[0];
                    bcrypt.compare(token, tokenDetails.token, async (rejected, accepted) => {

                        if (accepted) {
                            if (tokenDetails.expiredAt > new Date()) {

                                let userDetails = await UserModel.find({_id: tokenDetails.userId});
                                if(userDetails.length > 0){
                                    userDetails = userDetails[0];
                                    if(userDetails.isDeleted){
                                        return br.sendNotSuccessful(res, 'User is being deleted!', {});
                                    }else{
                                        await UserModel.updateOne({
                                            _id: tokenDetails.userId
                                        }, {
                                            password: await helper.hashPassword(password)
                                        });

                                        await ResetTokenModel.updateOne({
                                            _id: tokenDetails._id
                                        }, {
                                            expiredAt: new Date()
                                        });

                                        await sendEmail.sendPasswordResetCompletedEmail(userDetails.email);
                                        br.sendSuccess(res, {}, 'User password changed successfully!');
                                    }
                                }else{
                                    return br.sendNotSuccessful(res, 'User does not exists!', {});
                                }
                            } else {
                                br.sendNotSuccessful(res, 'Token Expired');
                            }
                        } else {
                            return br.sendNotSuccessful(res, 'Invalid token data');
                        }
                    });
                } else {
                    return br.sendNotSuccessful(res, 'Anonymous Token details!')
                }
            }).catch(err => {
                br.sendDatabaseError(res, err);
            });
        }
    });
});

module.exports = router;