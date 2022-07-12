const https = require('https');

module.exports = (mobileNumber, otp, callback) => {
    const reqUrl = "https://manage.ibulksms.in/api/sendhttp.php?authkey=2879AJCpDiLoT620b7415P15&mobiles=" +
    '91' +
        mobileNumber +
        '&message=Your login OTP is ' +
        otp +
        '&sender=dasham&route=4&country=91&DLT_TE_ID=1407161580865917790';

    https.get(reqUrl, (resp) => {
        let data = '';

        // A chunk of data has been received.
        resp.on('data', (chunk) => {
            data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            console.log(data);
            callback(data);
            //console.log(JSON.parse(data).explanation);
        });

    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });

}