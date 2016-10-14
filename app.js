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

tradeoffAnalyticsConfig.setupToken(app, {//for dev purposes. in bluemix it is taken from VCAP.
  url: process.env.TA_URL || 'https://gateway.watsonplatform.net/tradeoff-analytics/api/v1',
  username: process.env.TA_USERNAME || 'USERNAME',
  password: process.env.TA_PASSWORD || 'PASSWORD',
  version: 'v1'
});

app.get('/', function(req, res) {
  res.render('index', {
    ct: req._csrfToken,
    GOOGLE_ANALYTICS_ID: process.env.GOOGLE_ANALYTICS_ID
  });
});
app.get('/refresh', function(req, res) {
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

var FILE_RAW = 'config/ml/users_raw.json';
var FILE_PROBLEM = './public/data/auto.json';
var FILE_TEMPLATE= './config/ml/problem.template.json';
var edmunds = require('./config/edmunds/Edmunds');
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
function refreshData(){
  if(refreshing){
    return;
  }
  var startTime = Date.now();
  refreshing = true;
  function onFailure(err){
    console.log('import failed. \n'+ err);
    refreshing = false;
  }

  function transform(problem){
    fs.writeFile(FILE_PROBLEM, JSON.stringify(problem,  null, 2));
    refreshing = false;

    var duration  = (Date.now() - startTime),
      m= Math.floor(duration/MINUTE),
      s= Math.floor((duration-m*MINUTE)/SECOND);
    console.log("Duration: "+m+"M:"+s+"s");
  }

  var data = JSON.parse(fs.readFileSync(FILE_RAW));
  fs.readFile(FILE_TEMPLATE, function(err, buff){
    if(err) {
      throw err;
    }
    var problem = JSON.parse(buff);
    problem.options = data;
    transform(problem);
  });
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
