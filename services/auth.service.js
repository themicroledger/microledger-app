const JWT = require("jsonwebtoken");
const User = require("../models/userModel");
const ResetToken = require("../models/resetTokenModel");
const sendEmail = require("../helper/email/sendEmail");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const signup = async (data) => {
    let user = await User.findOne({ email: data.email });
    if (user) {
        throw new Error("Email already exist");
    }
    user = new User(data);
    const token = JWT.sign({ id: user._id }, JWTSecret);
    await user.save();
    return (data = {
        userId: user._id,
        email: user.email,
        name: user.name,
        token: token,
    });
};

const requestPasswordReset = async (email) => {

    const user = await User.findOne({ email });
    let clientURL = process.env[`APP_HOME_URL_${process.env.APP_ENV_MODE}`];
    if (!user) throw new Error("User does not exist");
    let token = await ResetToken.findOne({ userId: user._id });
    if (token) await token.deleteOne();
    let resetToken = crypto.randomBytes(32).toString("hex");
    const hash = await bcrypt.hash(resetToken, Number(bcryptSalt));

    await new ResetToken({
        userId: user._id,
        token: hash,
        expiredAt: new Date(Date.now() + (4*1000*3600)),
        createdAt: new Date.now(),
    }).save();

    const link = `${clientURL}/passwordReset?token=${resetToken}&email=${user.email}`;
    await sendEmail.sendPasswordResetEmail(user.email, link);
    return link;
};

const resetPassword = async (userId, token, password) => {
    let passwordResetToken = await ResetToken.findOne({ userId });
    if (!passwordResetToken) {
        throw new Error("Invalid or expired password reset token");
    }
    const isValid = await bcrypt.compare(token, passwordResetToken.token);
    if (!isValid) {
        throw new Error("Invalid or expired password reset token");
    }
    const hash = await bcrypt.hash(password, Number(bcryptSalt));
    await User.updateOne(
        { _id: userId },
        { $set: { password: hash } },
        { new: true }
    );
    const user = await User.findById({ _id: userId });
    sendEmail.passwordResetCompletedEmail(
        user.email,
        "Password Reset Successfully",
        user.email
    );
    await passwordResetToken.deleteOne();
    return true;
};