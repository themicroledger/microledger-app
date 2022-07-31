const express = require("express");
const crypto = require('crypto');
const bcrypt = require("bcrypt");
const UserModel = require("../../models/userModel");
const TokenModel = require("../../models/tokenModel");
const helper = require("../../helper/helper");
const logger = require('../../helper/logger');
const { Validator } = require("node-input-validator");
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
                br.sendNotSuccessful(res,'validation Error', v.errors);
            } else {
                const loginUser = await UserModel.find({ email: req.body.email, isDeleted: false }).populate('password');

                if (loginUser < 1) {
                    br.sendNotSuccessful(res, 'User not found!');
                }else{

                    const cmp = await bcrypt.compare(req.body.password, loginUser[0].password);
                    if (cmp) {
                        const token = helper.generateToken({
                            email: loginUser[0].email
                        });
                        br.sendSuccess(req, {
                            userData: {
                                id: loginUser[0]._id,
                                firstName: loginUser[0].firstName,
                                lastName: loginUser[0].lastName,
                                email: loginUser[0].email,
                                profilePicUrl: loginUser[0].profilePicUrl,
                                dob: loginUser[0].dob,
                                gender: loginUser[0].gender,
                                roles: loginUser[0].roles,
                                isVerified: loginUser[0].isVerified,
                            },
                            token: token
                        }, 'Login successful');
                    }else{
                        br.sendNotSuccessful(res,'Incorrect user password!');
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
            res.status(422).send(br.withError('Missed Required files', v.errors));
        } else {
            UserModel.find({ email: req.body.email, isDeleted: false }).then((userDetails) => {
                if (userDetails.length < 1) {
                    br.sendNotSuccessful(res, 'User not found!');
                }else{
                    userDetails = userDetails[0];
                    TokenModel.deleteMany({
                        userId: userDetails._id
                    }).then( result => {
                        console.log(result);
                        let resetToken = crypto.randomBytes(32).toString("hex");
                        bcrypt.hash(resetToken, Number(bcryptSalt)).then( async (err, hash) => {
                            if(err){
                                logger.error(err);
                                logger.error('Unable to generate reset token UserId => ' + userDetails._id.toString());
                                br.sendError(res, {}, 'Unable to generate reset token!');
                            }else{
                                await new Token({
                                    userId: userDetails._id,
                                    token: hash,
                                    createdAt: Date.now(),
                                }).save();

                                sendEmail(userDetails.email,"Password Reset Request",{name: user.name,link: link,},"./template/requestResetPassword.handlebars");
                            }
                        }).catch( err => {
                            logger.error(err);
                            logger.error('Unable to generate reset token UserId => ' + userDetails._id.toString());
                            br.sendError(res, {}, 'Unable to generate reset token!');
                        });
                    }).catch( err => {
                        logger.error(err);
                        br.sendDatabaseError(res, {});
                    });
                    let resetToken = crypto.randomBytes(32).toString("hex");

                    //const link = `${clientURL}/passwordReset?token=${resetToken}&id=${user._id}`;
                }
            }).catch( err => {
                logger.error(err);
                br.sendDatabaseError(res, {});
            });
        }
    });
});

module.exports = router;