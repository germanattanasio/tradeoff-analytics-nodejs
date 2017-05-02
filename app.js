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

var watson = require('watson-developer-cloud');
var vcapServices = require('vcap_services');

var credentials = Object.assign({
  username: process.env.TRADEOFF_ANALYTICS_USERNAME || '<username>',
  password: process.env.TRADEOFF_ANALYTICS_PASSWORD || '<password>',
  url: process.env.TRADEOFF_ANALYTICS_URL || 'https://gateway.watsonplatform.net/tradeoff-analytics/api',
  version: 'v1',
}, vcapServices.getCredentials('tradeoff_analytics'));

var authorizationService = watson.authorization(credentials);

app.post('/api/tradeoff-analytics-token', function(req, res) {
  authorizationService.getToken(credentials, function (err, token) {
    if (!token) {
      console.log('error:', err);
      res.status(500).send('Error retrieving token');
    } else {
      res.send(token);
    }
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

var FILE_RAW = 'config/edmunds/cars_raw.json';
var FILE_PROBLEM = './public/data/auto.json';
var edmunds = require('./config/edmunds/Edmunds');
var fs = require('fs');

var SECOND = 1000;
var MINUTE= 60*SECOND;
var HOUR = 60*MINUTE;
var MAX_TIME_BETWEEN_IMPORTS = 24 * HOUR;
var TIME_BETWEEN_CHECKS = 1 * HOUR;

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
  try{
    edmunds.importEdmunds(function(data){// brings the data from RAW file instead from API
      fs.writeFile(FILE_RAW, JSON.stringify(data,  null, 2));
      edmunds.mapEdmunds(data, function(problem){
        fs.writeFile(FILE_PROBLEM, JSON.stringify(problem,  null, 2));
        refreshing = false;

        var duration  = (Date.now() - startTime),
          m= Math.floor(duration/MINUTE),
          s= Math.floor((duration-m*MINUTE)/SECOND);
        console.log('Duration: '+m+'M:'+s+'s');
      });
    }, onFailure);
  }catch(e){
    onFailure(e);
  }
    //the server will retry in the next check interval;
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
