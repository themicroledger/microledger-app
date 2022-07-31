const express = require("express");
const moment = require("moment");
const helper = require("../../../helper/helper");
const logger = require("../../../helper/logger");
const br = helper.baseResponse;
const router = new express.Router();
const ProcessRequestModel = require("../../../models/processRequestModel");
const fs = require('fs');
const {authUser, isValidParamId, haveDataToUpdate} = require('../../../middleware/auth');

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
    fs.readFile(__appBaseDir + '/helper/country_list.json', 'utf8', (err, data) => {
        if (err) {
            logger.error(err)
            br.sendServerError(res, err);
            return;
        }
        br.sendSuccess(res, JSON.parse(data));
    })
});

/**
 * @swagger
 * /api/v1/common/process-request/get-all:
 *  get:
 *      summary: Get all Countries
 *      tags: [Helper-Common]
 *      parameters:
 *      - name: id
 *        in: query
 *        description: Process Instance Id
 *        default: 12
 *      - name: startDate
 *        in: query
 *        description: Start Date
 *        default: 2022-07-01
 *      - name: endDate
 *        in: query
 *        description: End Date
 *        default: 2022-07-30
 *      - name: status
 *        in: query
 *        description: Process Status
 *        default: Success
 *      responses:
 *          200:
 *              description: Success
 *          default:
 *              description: Default response for this api
 */
router.get("/process-request/get-all", authUser, async (req, res) => {
    try {
        let filter = {}

        if (req.query.id !== undefined && parseInt(req.query.id) > 0) {
            filter.processId = req.query.id;
        }

        if (req.query.startDate !== undefined
            && req.query.endDate !== undefined
            && moment(req.query.startDate).isValid()
            && moment(req.query.endDate).isValid()) {
            filter.createdAt = {
                $gte: Date(moment(req.query.startDate).format()),
                $lte: Date(moment(req.query.endDate).format()),
            }
        }

        if (req.query.status !== undefined && req.query.status.length > 0) {
            filter.processStatus = {
                $regex: '/^' + req.id.status + '/i',
            }
        }

        console.log(filter);

        let processes = await ProcessRequestModel.find(filter);
        br.sendSuccess(res, processes);
    } catch (error) {
        logger.error(error);
        br.sendServerError(res, {});
    }
});

module.exports = router;