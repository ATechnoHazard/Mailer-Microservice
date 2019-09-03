const Express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes/index');

const app = Express();

if (!process.env.SENDGRID_API_KEY) {
    console.log("Environment variable SENDGRID_API_KEY is not set. Exiting.");
    process.exit();
}

if (!process.env.ACCESS_TOKEN) {
    console.log("Environment variable ACCESS_TOKEN is not set. Exiting");
    process.exit()
}

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());
app.use('/api/v1/', routes);
appPort = process.env.PORT || 4000;

const server = app.listen(appPort, () => {
    console.log(`Service is up and running on port ${server.address().port}.`);
});
