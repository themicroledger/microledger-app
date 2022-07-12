const express = require("express");
const helper = require("../../../helper/helper");
const ProcessRequestModel = require("../../../helper/helper");
const br = helper.baseResponse;
const router = new express.Router();
const fs = require('fs');
const { authUser, isValidParamId, haveDataToUpdate } = require('../../../middleware/auth');

/**
 * @swagger
 * /api/v1/common/process-request/get-all:
 *  get:
 *      summary: Get all Countries
 *      tags: [Helper-Common]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/process-request/get-all", authUser, async (req, res) => {

});

module.exports = router;