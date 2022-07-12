const express = require("express");
const helper = require("../../../helper/helper");
const br = helper.baseResponse;
const router = new express.Router();
const fs = require('fs');
const { authUser, isValidParamId, haveDataToUpdate } = require('../../../middleware/auth');

/**
 * @swagger
 * /api/v1/common/country/get-all:
 *  get:
 *      summary: Get all Countries
 *      tags: [Helper-Common]
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/country/get-all", authUser, async (req, res) => {
    fs.readFile(__appBaseDir + '/helper/country_list.json', 'utf8' , (err, data) => {
        if (err) {
            logger.error(err)
            br.sendServerError(res, err);
            return;
        }
        br.sendSuccess(res, JSON.parse(data));
    })
});

module.exports = router;