const nodemailer = require("nodemailer");
const logger = require('../../helper/logger');

const transporter = nodemailer.createTransport({
    host: 'mx1.a2d.email',
    port: 465,
    secure: true,
    auth: {
        user: process.env.SENDER_EMAIL, //Email
        pass: process.env.SENDER_PASS, // Password
    },
});
transporter.verify(function (error, success) {
    if (error) {
        console.log(error);
    } else {
        console.log("Mail Server is ready to take out messages");
    }
});

module.exports = {
    sendEmailVerifyMail: async (email, link) => {
        try {
            let mailOptions = {
                from: process.env.SENDER_EMAIL,
                to: email,
                subject: "Email Authentication",
                text: `Hi you have successfully registered please click on the ${link} for verify your email`,
            };

            logger.info(await transporter.sendMail(mailOptions));
            return true;
        } catch (e) {
            logger.error('Send Verify Email Mail! =>');
            logger.error(e.message);
            logger.error(e);
            return false;
        }
    },
    sendPasswordResetEmail: async (email, link) => {
        try {
            console.log('Start email');
            let mailOptions = {
                from: process.env.SENDER_EMAIL,
                to: email,
                subject: "Reset Password",
                text: `Please click below link to reset your password  => \n${link}\nThis link will be valid for 4 hours`,
            };

            logger.info(await transporter.sendMail(mailOptions));
            return true;
        } catch (e) {
            logger.error('Send Password Reset Email! =>');
            logger.error(e.message);
            logger.error(e);
            return false;
        }
    },
    sendPasswordResetCompletedEmail: async (email) => {
        try {
            let mailOptions = {
                from: process.env.SENDER_EMAIL,
                to: email,
                subject: "Password Changed Successfully",
                text: `Your account password has been changed successfully!`,
            };

            logger.info(await transporter.sendMail(mailOptions));
            return true;
        } catch (e) {
            logger.error('Send Password Changed Email! =>');
            logger.error(e.message);
            logger.error(e);
            return false;
        }
    },
};