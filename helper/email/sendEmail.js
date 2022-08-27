const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
    host: 'mx1.a2d.email',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SENDER_EMAIL, //Email
        pass: process.env.SENDER_PASS, // Password
    },
});

module.exports = {
    sendEmailVerifyMail: (req, res, email, link) => {

        let mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: email,
            subject: "Email Authentication",
            text: `Hi you have successfully registered please click on the ${link} for verify your email`,
        };

        return transporter.sendMail(mailOptions);
    },
    sendPasswordResetEmail: (email, link) => {

        let mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: email,
            subject: "Reset Password",
            text: `Please click below link to reset your password  => ${link}. This link will be valid for 4 hours`,
        };

        return transporter.sendMail(mailOptions);
    },
    passwordResetCompletedEmail: (req, res, email) => {

        let mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: email,
            subject: "Password Changed Successfully",
            text: `Your account password has been changed successfully!`,
        };

        return transporter.sendMail(mailOptions);
    },
};