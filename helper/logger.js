const winston = require('winston');

const customFormat = winston.format.combine(winston.format.timestamp(), winston.format.printf( info => {
    return `${info.timestamp} - [${info.level.toUpperCase().padEnd(7)}] - ${(typeof info.message === 'object' ? JSON.stringify(info.message, null, 2) : info.message)}`
}));

const logger = winston.createLogger({
    format: customFormat,
    transports: [
        //
        // - Write all logs with importance level of `error` or less to `error.log`
        // - Write all logs with importance level of `info` or less to `combined.log`
        //
        new winston.transports.Console({ level: 'silly' }),
        new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: './logs/fromInfo.log', level: 'info' }),
    ],
});

/*//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}*/

module.exports = logger;