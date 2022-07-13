const express = require("express");
const UserModel = require("../../../models/userModel");
const helper = require("../../../helper/helper");
const fs = require('fs');
const logger = require('../../../helper/logger');
const br = helper.baseResponse;
const router = new express.Router();

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


module.exports = router;
