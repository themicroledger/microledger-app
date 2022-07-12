const csv = require("csv-parser");
const fs = require('fs');
const ProcessRequestModel = require('../../../models/processRequestModel');
const helper = require("../../../helper/helper");
const br = helper.baseResponse;
const logger = require("../../../helper/logger");

module.exports = {
    processBulkInsert: async (req, res, processName, insertData) => {
        //initiate process
        let process = new ProcessRequestModel({
            processName: processName + ' - Bulk Insert',
            createdByUser: req.appCurrentUserData._id
        });
        try {
            await process.save();

            //open log file
            if (!fs.existsSync(__appBaseDir + '/public/uploads/bulk/results/' + process.processId)) {
                fs.mkdirSync(__appBaseDir + '/public/uploads/bulk/results/' + process.processId, {recursive: true});
            }

            let logFileName = __appBaseDir + '/public/uploads/bulk/results/' + process.processId + '/' + process._id + '.log';
            let logFh = fs.createWriteStream(logFileName);
            logFh.write('________Initiated! => ' + Date().toString() + '________\r\n\r\n');
            console.log('________Initiated! => ' + Date().toString() + '________\r\n');

            if (req.file !== undefined && req.file.mimetype === 'text/csv') {

                let i = 0;
                let successCount = 0;
                let errorCount = 0;
                let errorOccurred = false;
                let allProcess = [];

                fs.createReadStream(req.file.path)
                    .pipe(csv())
                    .on('data', function (row) {
                        ++i; //increase count
                        console.log(i, ' => ', row);
                        //process on each row read
                        allProcess.push(new Promise(function (done) {
                            insertData(req, row, i, (counter, isSuccess, msg, data = {}) => {
                                let str = `#${counter}=> `;
                                if (isSuccess) {
                                    str += `Success => id => ${data._id}\r\n`;
                                    successCount++;
                                } else {
                                    str += `Error => InvalidData => ${msg}\r\n${JSON.stringify(data, null, 2)}\r\nSkipped (#${counter})\r\n`;
                                    errorOccurred = true;
                                    errorCount++;
                                }
                                console.log(str);
                                logFh.write(str);
                                done();
                            }, (counter, err) => {
                                errorCount++;
                                console.log(`#${counter}=> Error => InvalidData => ${err.message}\r\n${err.stack}\r\nSkipped (#${counter})\r\n`);
                                logFh.write(`#${counter}=> Error => InvalidData => ${err.message}\r\n${err.stack}\r\nSkipped (#${counter})\r\n`);
                                errorOccurred = true;
                                logger.error(err.message);
                                logger.error(err);
                                done();
                            });
                        }));
                    })
                    .on('end', function () {
                        Promise.all(allProcess).then(async d => {
                            logFh.write('\r\n________Completed! => ' + Date().toString() + '________');
                            console.log('\r\n________Completed! => ' + Date().toString() + '________');

                            logFh.close();
                            console.log('Log file closed');

                            if (errorOccurred) {
                                let upData = {
                                    processStatus: helper.sysConst.processStatus.PartiallyDone,
                                    changedByUser: req.appCurrentUserData._id,
                                    changedDate: new Date(),
                                    data: {
                                        logFilePath: helper.getAppBaseUrl() + logFileName.replace(__appBaseDir + '/public/', ''),
                                        successCount: successCount,
                                        errorCount: errorCount
                                    }
                                }
                                await ProcessRequestModel.updateOne({_id: process._id}, upData);
                                upData.data.processDetails = await ProcessRequestModel.findById(process._id);
                                br.sendSuccess(res, upData.data, 'Bulk Insert Completed! some items got skipped => see the log file to know more!');
                            } else {
                                let upData = {
                                    processStatus: helper.sysConst.processStatus.Done,
                                    changedByUser: req.appCurrentUserData._id,
                                    changedDate: new Date(),
                                    data: {
                                        logFilePath: helper.getAppBaseUrl() + logFileName.replace(__appBaseDir + '/public/', ''),
                                        successCount: successCount,
                                        errorCount: errorCount
                                    }
                                }
                                await ProcessRequestModel.updateOne({_id: process._id}, upData);
                                upData.data.processDetails = await ProcessRequestModel.findById(process._id);
                                br.sendSuccess(res, upData.data, 'Bulk Insert Completed Successfully!');
                            }
                            console.log(i, ' => ','Process Done!');
                        }).catch(async e => {
                            console.log('Promise all Catch => ', e);
                            logger.error(`Bulk Upload for ${logFileName} =>  Promise all Catch => `);
                            logger.error(e);
                            if(logFh.writable){
                                logFh.write(JSON.stringify(e, null, 2));
                            }else{
                                logFh = fs.createWriteStream(logFileName, {flags: 'a'});
                                console.log('Log file opened once gain');
                                logFh.write('\r\n________On Read Csv Stream Catch________\r\n');
                                logFh.write(JSON.stringify(e, null, 2));
                            }
                            logFh.close();
                            console.log('Log file closed 2nd time!');

                            let upData = {
                                processStatus: helper.sysConst.processStatus.Error,
                                changedByUser: req.appCurrentUserData._id,
                                changedDate: new Date()
                            }
                            await ProcessRequestModel.updateOne({_id: process._id}, upData);
                            br.sendServerError(res, e);
                        });
                    });
            } else {
                logFh.write('Not a valid file! Closing Process');
                logFh.close();
                let upData = {
                    processStatus: helper.sysConst.processStatus.Error,
                    changedByUser: req.appCurrentUserData._id,
                    changedDate: new Date()
                }
                await ProcessRequestModel.updateOne({_id: process._id}, upData);
                if (req.file !== undefined && req.file.path) {
                    await this.deleteFileIfExists(req.file.path);
                }
                br.sendNotSuccessful(res, 'Please send a valid file');
            }
        } catch (e) {
            br.sendServerError(res, e);
        }
    },
};