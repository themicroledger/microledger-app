const multer = require('multer');
const fs = require('fs');

const bulkStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (!fs.existsSync(__appBaseDir + '/public/uploads/bulk/raw_files/')) {
            fs.mkdirSync(__appBaseDir + '/public/uploads/bulk/raw_files/', {recursive: true});
        }

        cb(null, __appBaseDir + '/public/uploads/bulk/raw_files/');
    },
    filename: function (req, file, cb) {
        cb(null, (new Date().toISOString() + '_rf_' +  file.originalname).replace(/:|\.|-|\(|\)/g, '_') + '.' + file.mimetype.split('/')[1]);
    }
});

const bondAttachmentStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (!fs.existsSync(__appBaseDir + '/public/uploads/bond/attachments/')) {
            fs.mkdirSync(__appBaseDir + '/public/uploads/bond/attachments/', {recursive: true});
        }

        cb(null, __appBaseDir + '/public/uploads/bond/attachments/');
    },
    filename: function (req, file, cb) {
        cb(null, (new Date().toISOString() + '_rf_' +  file.originalname).replace(/:|\.|-|\(|\)/g, '_') + '.' + file.mimetype.split('/')[1]);
    }
});

const fileFilter = (req, file, cb) => {
    if (file) {
        cb(null, true)
    } else {
        cb(null, false)
    }
}

module.exports = {
    bulkUploader: multer({storage: bulkStorage, fileFilter: fileFilter}),
    bondAttachUploader: multer({storage: bondAttachmentStorage, fileFilter: fileFilter})
};