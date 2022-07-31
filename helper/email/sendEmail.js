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
    sendPasswordResetEmail: (req, res, email, link) => {

        let mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: email,
            subject: "Reset Password",
            text: `Please click below link to reset your password  => ${link}`,
        };

        return transporter.sendMail(mailOptions);
    },
};