//define global variables
global.__appBaseDir = __dirname;

//import packages
const express = require("express");
const { mongoConnect } = require("./config/db");
const swaggerUI = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require('fs');
const logger = require('./helper/logger');
const appRoutes = require('./routes/index.routes');

//create required log folders
if(!fs.existsSync('./logs')){
  fs.mkdirSync('./logs');
  logger.info('log folder created');
}

dotenv.config();
mongoConnect().then(r => console.log('Db Performed'));

/**
 * @swagger
 * components:
 *  schemas:
 *      SuccessResponse:
 *          type: object
 *          properties:
 *              success:
 *                  type: boolean
 *              msg:
 *                  type: string
 *                  default: ''
 *              data:
 *                  type: object
 *      ErrorResponse:
 *          type: object
 *          properties:
 *              success:
 *                  type: boolean
 *              msg:
 *                  type: string
 *              errors:
 *                  type: object
 */
const specs = swaggerJsDoc({
  definition: {
    openapi : "3.0.0",
    info: {
      title: "The Micro Ledger API",
      version: "1.0.0",
      description: "The Micro Ledger library api v1"
    },
    components: {
      securitySchemes:{
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    servers: [
      {
        url: "http://localhost:" + process.env.PORT,
        description: 'Local Server'
      },
      {
        url: "https://app-stage.themicroledger.com",
        description: 'Staging Server'
      },
      {
        url: "https://app.themicroledger.com",
        description: 'Production Server'
      }
    ],
  },
  apis: [
    "./routes/*/*.js",
    "./routes/*/*/*.js",
  ]
});

const app = express();

//allow cross
app.use(cors());

//setup swagger UI
if(process.env.APP_ENV_MODE !== 'PROD'){
  app.use("/api/v1/docs", swaggerUI.serve, swaggerUI.setup(specs));
}

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(express.json());

//console out all the apis request
app.use( (req, res, next) => {
  if(req.path.includes('/api/')){
    logger.info('Path:' + req.path);
    logger.info('req body data =>');
    logger.info(req.body);
  }
  next();
});
app.use('/uploads/bulk/results/', express.static(__appBaseDir + '/public/uploads/bulk/results/'));

//app.use("/api", require('./routes/index.routes'));
appRoutes(app);

//ping
app.get("/", (req, res) => {
  //ping
  res.send({
    code: 200,
  });
});
app.listen(process.env.PORT || 5000, () => {
  logger.info(`Server is Listening ${process.env.PORT}`);
}).on('error', function (err) {
  logger.error(err);
});
