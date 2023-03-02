const bcrypt = require("bcrypt");
const axios = require("axios");
const mongo = require("mongoose");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const logger = require("./logger");
const jwtSecret = process.env.JWT_SECRET;
const hashSalt = Number(process.env.BCRYPT_SALT);
const EmployeeActivityTypes = {location: 'location', login: 'login', logout: 'logout'};
const orderStatusTypes = {Awaiting: 'Awaiting', InProgress: 'InProgress', FullFilled: 'FullFilled'};
const userStatus = {Active: 'Active', Inactive: 'Inactive', PendingApproval: 'PendingApproval'};
const permissionAccessTypes = {
    CREATE: 'C',
    READ: 'R',
    EDIT: 'E',
    DELETE: 'D'
};
const processStatus = {
    Initialised: 'Initialised',
    Processing: 'Processing',
    Done: 'Done',
    PartiallyDone: 'PartiallyDone',
    Error: 'Error'
};
const processType = {
    BulkInsert: 'BulkInsert',
    BulkUpdate: 'BulkUpdate'
};
const referenceTermLength = {
    Month: 'Month', Years: 'Years', Days: 'Days'
}
const referenceRateConvention = {
    Money: 'Money', Market: 'Market', Rate: 'Rate'
}
const transactionCodeLifeCyclePeriodTypes = {
    Opening: 'Opening', Holding: 'Holding', Closing: 'Closing'
}
const transactionCodeTransactionLevels = {
    Lot: 'Lot', Holding: 'Holding', Both: 'Both'
}
const acPeriodUnit = {
    Month: 'Month', Year: 'Year', Day: 'Day'
}
const ledgerTypes = {
    Parent: 'Parent', Child: 'Child'
}
const periodTypes = {
    Operating: 'Operating',
    Closing: 'Closing',
    Initiation: 'Initiation',
    Other: 'Other'
}
const ledgerPeriodStatus = {
    Open: 'Open',
    Close: 'Closed'
}
const lastCoupon = {
    Regular: 'Regular',
    Irregular: 'Irregular'
}
const compoundingConvention = {
    Compound: 'Compound',
    CompoundedYield: 'CompoundedYield'
}
const spreadConventionOrCompounding = {
    CompoundAndAdd: 'Compound and Add',
    AddAndCompound: 'Add and Compound',
    Flat: 'Flat'
}
const putCall = {
    Put: 'Put',
    Call: 'Call'
}

const helper = {
    sysConst: {
        EmployeeActivityTypes,
        orderStatusTypes,
        userStatus,
        permissionAccessTypes,
        processStatus,
        processType,
        referenceTermLength,
        referenceRateConvention,
        transactionCodeLifeCyclePeriodTypes,
        transactionCodeTransactionLevels,
        acPeriodUnit,
        ledgerTypes,
        periodTypes,
        ledgerPeriodStatus,
        lastCoupon,
        compoundingConvention,
        spreadConventionOrCompounding,
        putCall
    },
    generateTokenWithPayLoad: (email, userId, secondsRemaining = '12h') => {
        return jwt.sign(
            {
                email: email,
                userId: userId
            },
            jwtSecret,
            {
                //expiresIn: "12h",
                expiresIn: `${secondsRemaining}`
            }
        );
    },
    generateToken: (data, secondsRemaining = '12h') => {
        return jwt.sign(
            data,
            jwtSecret,
            {
                //expiresIn: "12h",
                expiresIn: `${secondsRemaining}`
            }
        );
    },
    verifyToken: (token, verified) => {
        jwt.verify(token, jwtSecret, verified);
    },
    getAppBaseUrl() {
        return process.env['APP_BASE_URL_' + process.env.APP_ENV_MODE];
    },
    getBoolean(val) {
        val = val !== undefined && val !== null ? val.toString().toLowerCase().trim() : false;
        switch (val) {
            case "true":
            case true:
            case "1":
                return true;
            case "false":
            case false:
            case "0":
                return false;
            default:
                Boolean(val);
        }
    },
    isObjectContainsKey: (obj, val) => {
        if (val === undefined || val === null) {
            return false;
        }
        let keys = Object.keys(obj);
        for (let key in keys) {
            if (obj[keys[key]] === val) {
                return true;
            }
        }
        return false;
    },
    deleteFileIfExists: (path) => {
        return new Promise((callback) => {
            fs.access(path, fs.F_OK, (err) => {
                if (err) {
                    //file does not exists
                    return callback(false);
                }
                //file exists need to delete
                fs.unlink(path, (err) => {
                    if (err) {
                        return callback(false);
                    }
                    callback(true);
                });
            });
        });
    },
    generateOTP: () => {
        // Declare a digits variable
        // which stores all digits
        let digits = '0123456789';
        let OTP = '';
        for (let i = 0; i < 6; i++) {
            OTP += digits[Math.floor(Math.random() * 10)];
        }
        return OTP;
    },
    sendOtp: (otp, mobileNo, callback) => {
        const api_key = process.env.SMS_API_KEY
        const TE_ID = process.env.TE_ID
        const sender = process.env.SENDER
        const message = `Your login OTP is ${otp}`
        const api_url = `https://manage.ibulksms.in/api/sendhttp.php?authkey=${api_key}&mobiles=${mobileNo}&message=${message}&sender=${sender}&route=4&country=91&DLT_TE_ID=${TE_ID}`;

        console.log(mobileNo, otp.toString());
        logger.info(mobileNo + ' => ' + otp.toString());
        axios.get(`${api_url}`).then((res) => {
            //console.log(res.data);
            callback(res.data, undefined);
        }, (error) => {
            console.log(error);
            callback(undefined, error);
        });
    },
    hashPassword: async (password) => {
        return await new Promise((resolve, reject) => {
            bcrypt.hash(password, hashSalt, function (err, hash) {
                if (err) reject(err);
                resolve(hash);
            });
        });
    },
    baseResponse: {
        withSuccess: (msg, data) => {
            return {
                success: true,
                msg: msg,
                data: data
            };
        },
        withError: (msg, errors = {}) => {
            return {
                success: false,
                msg: msg,
                errors: errors
            };
        },
        serverError: (err, res) => {
            logger.info('Server Error: ' + JSON.stringify(err));
            res.status(500).send({
                success: false,
                msg: 'Server Error!',
                errors: err
            });
        },
        sendSuccess: (res, data, msg = 'done') => {
            let responseData = {
                success: true,
                msg: msg,
                data: data
            };
            logger.info(responseData);
            return res.status(200).send(responseData);
        },
        sendError: (res, errors = {}, msg = 'error', code = 400) => {
            let responseData = {
                success: false,
                msg: msg,
                errors: errors
            };
            logger.error(responseData);
            return res.status(code).send(responseData);
        },
        sendNotSuccessful: (res, msg = 'error', errors = {}) => {
            let responseData = {
                success: false,
                msg: msg,
                errors: errors
            };
            logger.error(responseData);
            return res.send(responseData);
        },
        sendServerError: (res, errors = {}, msg = 'Server error', code = 500) => {
            let responseData = {
                success: false,
                msg: msg,
                errors: errors
            };
            logger.error('Server Error: ');
            logger.error(errors);
            logger.error(errors.stack);
            logger.error('Response Data: \r\n' + JSON.stringify(responseData, null, 2));
            return res.status(code).send(responseData);
        },
        sendDatabaseError: (res, errors = {}, msg = 'Db error', code = 502) => {
            logger.error(errors);
            return res.status(code).send({
                success: false,
                msg: msg,
                errors: errors
            });
        }
    },
    getRandomInt: (max = 9, min = 2) => {
        return Math.floor(Math.random() * (max - min + 1) + min);
    },
    autoIncrementId: async function (model, data, field, next) {
        // Only applies to new documents, so updating with model.save() method won't update id
        // We search for the biggest id into the documents (will search in the model, not whole db
        // We limit the search to one result, in descendant order.
        if (data.isNew) {
            let total = await model.find().sort({[field]: -1}).limit(1);
            data[field] = total.length === 0 ? 1 : Number(total[0][field]) + 1;
            data.createdAt = new Date();
            data.updatedAt = new Date();
            next();
        }
    },
    userNotAllowed: function (res, loggingInfo = '') {
        if (loggingInfo.length > 0) {
            logger.error(loggingInfo);
        }
        return res.status(200).send({
            success: false,
            msg: 'You do not have sufficient permissions to access it',
            errors: {}
        });
    },
    isValidObjectId: (id) => {
        return id && id.trim() !== '' && mongo.Types.ObjectId.isValid(id);
    }
};

module.exports = helper;