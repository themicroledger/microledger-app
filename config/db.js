const mongoose = require("mongoose");
const logger = require('./../helper/logger');

const mongoConnect = async () => {
  try {
    let mode = process.env.APP_ENV_MODE;
    logger.info('ENV: ' + mode);
    await mongoose.connect( process.env['MONGO_CONNECT_' + mode], {
      ssl: true,
      sslValidate: true,
      sslCert: `${__appBaseDir}/mongo_certificate_${mode.toLowerCase()}.cer`,
      sslKey: `${__appBaseDir}/mongo_certificate_${mode.toLowerCase()}.cer`,
      authMechanism: 'MONGODB-X509'
    });
    console.log("Connected to Mongo database");
    logger.info("Connected to Mongo database");
  } catch (e) {
    console.log(`Error connecting to mongo database ${e}`, e);
    logger.error(`Error connecting to mongo database ${e.toString()}`);
    logger.error(e);
  }
};

module.exports = {mongoConnect: mongoConnect};