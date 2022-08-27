const express = require("express");
const UserModel = require("../../../models/userModel");
const helper = require("../../../helper/helper");
const fs = require('fs');
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();
const {authUser} = require('../../../middleware/auth');

/**
 * @swagger
 * /api/v1/user/seed:
 *  get:
 *      summary: Seed
 *      tags: [User]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/seed", async (req, res) => {
  try {
    await UserModel.deleteMany({});

    const saveRegistration = new UserModel({
      name: 'Admin',
      email: 'admin@gmail.com',
      password: await helper.hashPassword('admin'),
      phoneNumber: '1234567890',
      dob: Date.parse('1996-10-19'),
      gender: 'Male',
      roles: [
          'SUPER_ADMIN'
      ],
      isVerified: true
    });
    let result = await saveRegistration.save();
    if (result) {
      logger.info(result);
      res.send(helper.baseResponse.withSuccess('User seed completed', {}));
    }
  } catch (error) {
    logger.error(error);
    br.sendServerError(res, {});
  }
});

/**
 * @swagger
 * /api/v1/user/seed:
 *  get:
 *      summary: Seed
 *      tags: [User]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/create", authUser, (req, res) => {
  try {
    const v = new Validator(req.body, {
      name: 'required|string|minLength:5',
      email: 'required|email',
      phoneNumber: 'required|digits:10',
      password: 'required|string|minLength:5|maxLength:16',
      dob: 'required|date',
      gender: 'required|string',
      roles: 'required|string'
    });

    v.check().then(async (matched) => {
      if (!matched) {
        br.sendNotSuccessful(res, 'Missing required fields!', v.errors);
      } else {
        let {name, email, password, phoneNumber, dob, gender, roles} = req.body;

        const saveRegistration = new UserModel({
          name: name,
          email: email,
          password: await helper.hashPassword(password),
          phoneNumber: phoneNumber.toString(),
          dob: Date.parse(date),
          gender: gender,
          roles: [
            'DATA_ENTRY'
          ],
          isVerified: false
        });
        let result = await saveRegistration.save();

        if (result) {
          logger.info(result);

          let token = '';
          let link = process.env['APP_BASE_URL_' + process.env.APP_ENV_MODE]
              + 'api/' + process.env.API_VERSION + '/auth/verify/email?verifyToken='
          + token;
          await sendEmail.sendEmailVerifyMail(email, link);
          br.sendSuccess(res,{}, 'User seed completed');
        }else{
          br.sendNotSuccessful(res, 'Something went wrong!');
        }
      }
    });
  } catch (error) {
    logger.error(error);
    br.sendServerError(res, {});
  }
});


module.exports = router;
