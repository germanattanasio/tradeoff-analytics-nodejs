/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// load environment properties from a .env file for local development
require('dotenv').load({silent: true});

var express    = require('express'),
  app          = express();
// Bootstrap application settings
require('./config/express')(app);

//integration with tradeoff analytics service
var tradeoffAnalyticsConfig = require('./config/tradeoff-analytics-config');

//MercadoLibre Integration
var meli = require('mercadolibre');
var meliObject = new meli.Meli(process.env.ML_APP_ID, process.env.ML_SECRET_KEY);

tradeoffAnalyticsConfig.setupToken(app, {//for dev purposes. in bluemix it is taken from VCAP.
  url: process.env.TA_URL || 'https://gateway.watsonplatform.net/tradeoff-analytics/api/v1',
  username: process.env.TA_USERNAME || 'USERNAME',
  password: process.env.TA_PASSWORD || 'PASSWORD',
  version: 'v1'
});

app.get('/', function(req, res) {
  res.render('bank', {
    ct: req._csrfToken,
    GOOGLE_ANALYTICS_ID: process.env.GOOGLE_ANALYTICS_ID
  });
});
app.get('/user', function(req, res) {
  res.render('seller', {
    ct: req._csrfToken,
    GOOGLE_ANALYTICS_ID: process.env.GOOGLE_ANALYTICS_ID
  });
});
app.get('/data', function(req, res) {
  refreshData();
  res.writeHead(200);
  res.end();
});
app.get('/last_refresh', function(req, res) {
  lastRefresh(function(time){
    res.writeHead(200, { 'Content-Type': 'text/plain'});
    res.write(time.toJSON());
    res.end();
  });
});
app.post('/valid', function(req, res) {
  var data = getUserData();
  console.log(data)
  var problem = createDataRequest(data, FILE_TEMPLATE_PROFILE);
  res.json(problem);
});
app.get('/auth/mercadolibre', function (req,res) {
  var response = meliObject.getAuthURL('/check');
  res.json(response);
});
app.get('/check', function (req,res) {
  res.render('check', {
    ct: req._csrfToken,
    GOOGLE_ANALYTICS_ID: process.env.GOOGLE_ANALYTICS_ID
  });
});
app.post('/saveProfile', function (req,res) {
  var problem = JSON.parse(req.body.body);
  createProblem(problem);
  res.json(problem);
});

var FILE_RAW = 'config/ml/users_raw.json';
var FILE_PROBLEM = './public/data/auto.json';
var FILE_TEMPLATE= './config/ml/problem.template.json';
var FILE_TEMPLATE_PROFILE= './config/ml/problem_profile.template.json';
var fs = require('fs');

var SECOND = 1000,
  MINUTE= 60*SECOND,
  HOUR = 60*MINUTE;
var MAX_TIME_BETWEEN_IMPORTS = 24*HOUR;
var TIME_BETWEEN_CHECKS = 1*HOUR;

var refreshing= false;

function checkForRefresh(){
  lastRefresh(function(lastImportTime){
    var duration = (new Date() - lastImportTime);
    if(duration>MAX_TIME_BETWEEN_IMPORTS && !refreshing){
      refreshData();
    }
  });
}

function getUserData(){
  return [{
      "key": 454,
      "name": "Javier Segovia",
      "app_data": {
        "email": "jota.segovia@gmail.com",
        "phone": "+56 951336106"
      },
      "values": {
        "isActive": 1,
        "power_seller_status": "Gold",
        "age": 0,
        "rating": 0.5,
        "points": 100,
        "completedTransactions": 100
      }
  }]
}

function refreshData(){
  if(refreshing){
    return;
  }
  refreshing = true;
  var data = JSON.parse(fs.readFileSync(FILE_RAW));
  var problem = createDataRequest(data, FILE_TEMPLATE);
  createData(problem);
  refreshing = false;
}

function createData(problem){
  fs.writeFile(FILE_PROBLEM, JSON.stringify(problem,  null, 2));
}
function createProblem(problem){
  fs.writeFile(FILE_TEMPLATE_PROFILE, JSON.stringify(problem,  null, 2));
}

function createDataRequest(data, template){
  var buff = fs.readFileSync(template);
  var problem = JSON.parse(buff);
  problem.options = data;
  return problem;
}

setInterval(checkForRefresh, TIME_BETWEEN_CHECKS);

function lastRefresh(callback){
  fs.stat(FILE_PROBLEM, function(err, stats){
    if(stats){//file exist
      callback(new Date(stats.mtime));
    }else{
      callback(new Date(0));
    }
  });
}
checkForRefresh();


module.exports = app;
