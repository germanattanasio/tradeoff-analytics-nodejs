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
(function(){
  var dilemmaServiceUrl = "https://gateway.watsonplatform.net/tradeoff-analytics/api/v1/dilemmas?generate_visualization=false";

  /**
   * @typedef ColumnData
   * @type {Object}
   * @property {String} key
   * @property {String} full_name
   * @property {String} type - (text, numeric, categorical, etc.)
   * @property {Boolean} is_objective
   * @property {String} goal - min, max
   * @property {String} [format]
   * @property {Array.<String>} [range]
  */

  /**
   * @typedef ProblemData
   *
   * See public/data/auto.json for an example
   *
   * @type {Object}
   * @property {String} subject
   * @property {Array.<ColumnData>} columns
   * @property {Array} options
   */

  /**
   * @type {ProblemData}
   */
  var theProblem;
  var comparedOps = [undefined, undefined];
  var analyzedCols = [];
  var previousOp = new Array();


  /**********INPUTS**********/
  function initColumns() {
    $.getJSON('/data/auto.json').then(function(problem) {
      theProblem = problem;
      showInputCode();
      var cols = problem.columns.filter(function(col){
        var type = col.type && col.type.toLowerCase();
        return _.contains(['numeric', 'categorical', 'datetime'], type);
      });

      function disableButton(){
        var noObjectives = !cols.some(function(col){
          return col.is_objective;
        });
        $('.panel--button').prop('disabled', noObjectives);
      }
      var template = _.template('<div class="panel--option-item" title="{{title}}">{{name}}</div>');
      cols.forEach(function(col){
        var node = $(template({ name:columnName(col), title:col.description}));
        node.toggleClass('panel--option-item_ENABLED', col.is_objective);
        node.data('col', col);
        $('.panel--option-container').append(node);

        node.click(function() {
          col.is_objective = ! col.is_objective;
          showInputCode();
          $(this).toggleClass('panel--option-item_ENABLED', col.is_objective);
          disableButton();
        });
      });

      disableButton();
    });
  }
  function showInputCode(){
    var problemStr = JSON.stringify(theProblem, null, 2);
    $('.input--API .base--code.language-javascript').text(problemStr);
  }

  /**********SERVICE INTERACTION**********/
  function dilemma(problem) {
    console.log(problem);
    // automatically fetch the token right away
    // later, call getToken.then(function(token) {...}); to use it
    // it's valid for up to an hour
    var getToken = $.post('/api/tradeoff-analytics-token', {_csrf: $('meta[name="ct"]').attr('content')});
    getToken.fail(function(err) {
      console.log(err);
    });

    /**
     * Remove any info that is not relevant for the delima service,
     * returns the problem set with only objective fields that the user has selected
     * @param {ProblemData} problem
     * @returns {ProblemData}
     */
    function minimizeProblem(problem) {
      console.log(problem);
      var objs = problem.columns
          .filter(function(col){
            return col.is_objective;
          })
          .map(function(obj, i) {
            return {
              full_name: obj.full_name || obj.key,
              orgKey: obj.key,
              key: i,
              goal: obj.goal,
              is_objective: true,
              //format
              type: obj.type,
              range: obj.range,
              preference: obj.preference
            };
          });
      return {
        subject: problem.subject,
        columns: objs,
        options: problem.options.map(function(op) {
          var vals = {};
          _.each(objs, function(obj, i) {
            vals[i] = op.values[obj.orgKey];
          });
          return {
            key: op.key,
            values: vals
          };
        })
      };
    }

    function tranformResolution(dilemma, minProblem) {
      var res = dilemma.resolution;
      var objKeys = minProblem.columns.map(function(c) {
        return c.orgKey;
      });
      res.map && res.map.anchors.forEach(function(anc) {
        anc.name = objKeys[Number(anc.name)];
      });
      res.solutions.forEach(function(sol) {
        if (sol.status === "INCOMPLETE" && _.contains(["MISSING_OBJECTIVE_VALUE", "RANGE_MISMATCH"], sol.status_cause.error_code)) {
          sol.status_cause.tokens[0] = objKeys[Number(sol.status_cause.tokens[0])];
          minProblem.columns.forEach(function(c) {
            var newMsg = sol.status_cause.message.replace('column: "'+c.key+'"', 'column: "'+c.orgKey+'"');
            sol.status_cause.message = newMsg;
          });
        }
      });
      return res;
    }
    var minProblem = minimizeProblem(problem);
    return getToken.then(function(token) {
      return $.ajax(dilemmaServiceUrl, {
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(minProblem),
            headers: {
              "X-Watson-Authorization-Token": token,
              'X-Watson-Metadata' : 'dataset-name=edmunds;client=ta_demo_app;client-version=2.0;'
            }
          })
          .then(function(response) {
            return {
              problem: problem,
              resolution: tranformResolution(response, minProblem)
            };
          });
    });
  }

  /**********Analyze btn**********/
  function analyze() {
    $('._demo--comparison').hide();
    $('._demo--output').hide();
    $('._demo--error').empty().hide();
    $('._demo--loading').show();

    var selectedColumns = theProblem.columns.filter(function(c){return c.is_objective;});
    function findOptionByKey(key) {
      return _.findWhere(theProblem.options, {key: parseInt(key, 10)});
    }
    dilemma(theProblem)
      .then(function(result){
          analyzedCols = selectedColumns;
          showOutputCode(result.resolution);
          var winners = result.resolution.solutions.filter(function(s) {
            return s.status === "FRONT";
          }).map(function(w) {
            return findOptionByKey(w.solution_ref);
          });
          $('.output--frontier-size').text(winners.length);
          $('.output--dataset-size').text(result.resolution.solutions.length);
          makeFilters(winners, $('.filter--container'));
          showResults(winners, $('div.candidates'));

          comparedOps = [];
          makeComparisonTable();

          $('._demo--loading').hide();
          $('._demo--output').show();

          var top = document.getElementById('demo-input').offsetTop;
          window.scrollTo(0, top);
      })
      .fail(function(err){
        $('._demo--loading').hide();
        var txt = err.status + ' ' + err.statusText + ' ' + err.responseText;
        console.error(txt, err);

        var errMsg = "<div>Oops, algo malio sal</div>" + "<div>" + txt + "</div>";
        $('._demo--error').append(errMsg).show();
      });
  }
  function showOutputCode(resolution){
    var resolutionStr = JSON.stringify(resolution, null, 2);
    $('.output--API .base--code.language-javascript').text(resolutionStr);
  }

  /**********FILTERS**********/
  function makeFilters(options, parent){
    function filterChanged(){
      var evals = [];
      jQuery.each($('.objFilter'), function(i, node){
        evals.push( $(node).data('evalOp'));
      });
      var tiles = $('.candidates--item-container');
      $.each(tiles, function(i, tile){
        var isIn = evals.every(function(evalOp){
          var op = $(tile).data('op');
          return evalOp(op);
        });
      console.log(evals);
        $(tile).toggleClass('isIn', isIn);
      });
    }
    function makeCategoricalFilter(col, options, node){
      var vals = options.map( function(op){return op.values[col.key]});
      var range = col.range;
      range = _.intersection(range, vals);//only actual vals in the data
      range.forEach(function(val){
        var input = $(_.template('<span>'+
            '<input class="candidates--input base--checkbox" id="input--{{value}}" role="checkbox" type="checkbox" value="{{value}}" checked/>'+
            '<label class="candidates--label base--inline-label" for="input--{{value}}">{{value}}</label></span>',
            {value:val}));
        $('input', input).click(filterChanged);
        node.append(input);
      });
      node.data('evalOp', function(op){
        var val = op.values[col.key];
        var checkedInputs = $('input:checked', node);
        for(var i =0; i< checkedInputs.length; i++){
          if(val === $(checkedInputs[i]).val()){
            return true;
          }
        }
        return false;
      });
    }
    function makeNumericFilter(col, options, filterNode){
      var vals = options.map( function(op){return op.values[col.key]});
      var min = _.min(vals);
      var max = _.max(vals);
      var niceMin = (col.range && col.range.low) || Math.floor(Math.pow(10, (Math.log10(min)-2))) * Math.pow(10,2);
      var niceMax = (col.range && col.range.high) || Math.ceil(Math.pow(10, (Math.log10(max)-2))) * Math.pow(10,2);
      var initValue = col.goal==="min" ? max: niceMin;
      var wrapper = $('<span class="filter--numeric"></span>');
      wrapper.append(_.template('<span class="low">{{min}}</span>', {min:columnValue(col, niceMin)}));
      var input = $(_.template(
              '<input type="range" min="{{min}}" max="{{max}}" value="{{value}}"/>',
              {min: niceMin, max:niceMax, value:initValue}));
      input.on('input', function(){
        filterChanged();
        var filterVal = Number(input.val());
        if(col.goal === 'min'){
          $('.high', wrapper).text(columnValue(col,filterVal));
        }else{
          $('.low', wrapper).text(columnValue(col,filterVal));
        }
      });
      wrapper.append(input);
      wrapper.append(_.template('<span class="high">{{max}}</span>',
          {max:columnValue(col, niceMax)}));
      filterNode.append(wrapper);
      filterNode.data('evalOp', function(op){
        var val = op.values[col.key];
        var filterVal = Number(input.val());
        if(val<filterVal && col.goal === 'min'){
          return true;
        }
        if(val>filterVal && col.goal === 'max'){
          return true;
        }
        return false;
      });
    }

    parent.empty();
    analyzedCols.forEach(function(col){
      var node = $('<div class="objFilter"><div>');
      node.append(_.template('<span class="filter--obj-name" title="{{title}}">{{name}}</span>',
          {name: columnName(col), title: col.description}));

      if(col.type === 'numeric'){
        makeNumericFilter(col, options, node);
      }
      else if(col.type === 'categorical'){
        makeCategoricalFilter(col, options, node);
      }
      parent.append(node);
    });
  }

  /**********OPTIONS TILES**********/
  function showResults(winners, parent) {
    var cols = analyzedCols;

    function opTile(op){
      var paraValue = '';
      cols.forEach(function(col){
        var val = op.values[col.key];
        val = columnValue(col, val);
        paraValue += _.template(
            '<div class="candidates--item-para">{{objName}} : <span class="candidates--item-value">{{objValue}}</span></div>',
            {objName: columnName(col), objValue: val});
      });
      function addToComparison(){
        $(this).toggleClass('candidates--item-btn_BLUE');

        if ($(this).hasClass('candidates--item-btn_BLUE')){

          if(previousOp.length < 2){
            previousOp.push($(this).attr('id'));
          }
          else {
            $('#' + previousOp[1]).click();
            previousOp.push($(this).attr('id'));
          }

          if(_.contains(comparedOps, op)){
            return;
          }
          if(!comparedOps[0]){
            comparedOps[0] = op;
          }else {
            comparedOps[1] = op;
          }

          $('._demo--comparison').show();
        } else {

          if(previousOp.length == 1){
            previousOp.pop();
          }
          else if(previousOp.length == 2){
            if(previousOp[0] == $(this).attr('id')){
              previousOp[0] = previousOp[1];
              previousOp.pop();
            }
            else {
              previousOp.pop();
            }
          }


          if(comparedOps[0] == op){
            comparedOps[0] = undefined;
          }else {
            comparedOps[1] = undefined;
          }
        }
        makeComparisonTable(comparedOps[0], comparedOps[1]);

        var top = document.getElementById('demo-comparison').offsetTop;
        window.scrollTo(0, top);
      }

      var node = $(_.template(
          '<div class="candidates--item-container ">'
          + '<h6 class="candidates--item-title">{{opName}}</h6>'
          + '<p class="candidates--item-des base--p">{{opDesc}}</p>'
          + '<div class="candidates--item-para-container">{{paraValue}}</div>'
          + '<div id="compare-{{key}}" class="candidates--item-btn">Agregar comparacion</div>'
        + '</div>',
        {key: op.key, opName: op.name, paraValue:paraValue, opDesc: op.description}));

      $('.candidates--item-btn', node).click(addToComparison);
      return node;
    }
    parent.empty();
    winners.forEach(function(op) {
      var tile = opTile(op);
      tile.addClass('isIn');
      tile.data('op', op);
      parent.append(tile);
    });
  }


  /**********COMPARISON**********/
  function makeComparisonTable(leftOp, rightOp){
    var opTemplate = '<div class="comparison--candidate">'+
                        '<div class="comparison--candidate-title-container">'+
                          '<h6 class="comparison--candidate-title">{{opName}}</h6>'+
                          '<p class="comparison--item-des base--p">{{opDesc}}</p>'+
                        '</div>'+
                        '<div class="comparison--candidate-paras"></div>'+
                        '<div class="comparison--choice">'+
                          '<span class="comparison--close icon icon-close" title="Elimina comparacion"></span>'+
                          '<span class="comparison--confirm icon icon-confirm" title="Has de esta tu opcion final"></span>'+
                        '</div>'+
                      '</div>';
    var opParaTemplate = '<div class="comparison--candidate-para">'+
        '<div class="comparison--candidate-para-name">{{objName}}</div>'+
        '<div class="comparison--candidate-para-value">{{objValue}}</div>'+
      '</div>';
    var diffTemplate = '<div class="comparison--candidate-difference"></div>';
    var diffParaTemplate = '<div class="comparison--candidate-difference-para">'+
        '<div class="comparison--candidate-difference-para-value">{{diff}}</div>'+
      '</div>';
    var cols = analyzedCols;
    function makeOp(op){
      function stopCompare(){
        $('#compare-' + op.key).click();
        $('.output--cong-text').css('display', 'none');
      }
      var node = $(_.template(opTemplate, {opName:op.name, opDesc: op.description}));
      $('.comparison--close', node).click(stopCompare);
      $('.comparison--confirm', node).click(function(){
        $('.output--cong-text').fadeIn('slow');
        $('.output--client-lib').fadeIn('slow');
      });

      var paras = $('.comparison--candidate-paras', node);
      cols.forEach(function(col){
        var val = op.values[col.key];
        paras.append(_.template(opParaTemplate, {objName: columnName(col), objValue: columnValue(col, val)}));
      });
      return node;
    }
    function makeDiff(){
      var node = $(diffTemplate);
      cols.forEach(function(col){
        var vl = leftOp.values[col.key],
          vr = rightOp.values[col.key],
          rightBetter,
          diffStr ='';

          if(col.type === 'numeric'){
            rightBetter = (col.goal==='min' && vr<vl) || (col.goal==='max' && vr>=vl);
            if((vr-vl) < 0)
              diffStr = '-' + columnValue(col, Math.abs(vr-vl));
            else
              diffStr = '+' + columnValue(col, Math.abs(vr-vl));
          }
          if(col.type==='categorical'){
            var il = col.range.indexOf(vl),
              ir = col.range.indexOf(vr);
            rightBetter = (col.goal==='min' && ir<il) || (col.goal==='max' && ir>=il);
            diffStr = vl + '&rarr;' + vr;//right arrow
          }

        var paraNode = $(_.template(diffParaTemplate, {diff:diffStr}));
        paraNode.toggleClass('rightBetter', rightBetter);
        node.append(paraNode);
      });
      return node;
    }

    var parent = $('.comparison--table');
    parent.empty();

    var node;
    if(leftOp) {
      node = makeOp(leftOp);
      node.addClass('comparison--candidate-1');
      parent.append(node);
    }
    if(leftOp && rightOp){
      node = makeDiff();
      parent.append(node);
    }
    if(rightOp) {
      node = makeOp(rightOp);
      node.addClass('comparison--candidate-2');
      parent.append(node);
    }
  }

  /**********UTILS**********/
  function columnName(col){
    return col.full_name || col.key;
  }
  function format(value, pattern){
    if(!pattern){
      return value;
    }
    var parts;
    pattern = pattern.trim();
    if(pattern.indexOf('|')>=0){
      parts = pattern.split('|');
      var curValue = value;
      parts.forEach(function(part){
        curValue = format(curValue, part);
      });
      return curValue;
    }
    if(pattern.startsWith('number')){
      parts = pattern.split(':');
      curValue = Number(value);
      if(parts[1]){
        var places = Number.parseInt(parts[1]);
        if(!isNaN(places)){
          curValue = curValue.toFixed(parts[1]);//returns string
          curValue = Number(curValue);
        }
      }
      return curValue.toLocaleString();
    }
    function pealString(str){
      if(str){
        str = str.trim();
        if(str.startsWith('"') && str.endsWith('"')){
          return str.substr(1, str.length-2);
        }
        if(str.startsWith("'") && str.endsWith("'")){
          return str.substr(1, str.length-2);
        }
      }
      return '';
    }
    if(pattern.startsWith('taPrefix')){
      parts = pattern.split(':');
      if(parts.length){
        return pealString(parts[1])+ value;
      }
    }
    if(pattern.startsWith('taSuffix')){
      parts = pattern.split(':');
      if(parts.length){
        return value + pealString(parts[1]);
      }
    }
    return value;
  }
  function columnValue(col, val){
    return format(val, col.format);
  }

  // AUTH
  function auth(){
    $.ajax('/auth/mercadolibre', {
      method: 'GET'
    }).then(function(response){
      window.location = response;
    })
  }
  function check(){
    console.log('validating');
    $.ajax('/valid', {
      method: 'post'
    }).then(function(response){
      console.log(response);
      // var result = dilemma(response);
      // console.log(result);
      var good = 'Felicidades, segun tus datos puedes optar por el Credito MICRO de BCI';
      var bad = 'Lo sentimos, segun tus datos no estas apto para ninguno de nuestros creditos registrado, sin embargo te notificaremos a la brevedad cuando uno de nustros creditos nuevos se adapten a sus necesidades';
      $('._demo--output').append(good).show();
    })
  }
  function save(){
    var subject = theProblem.subject
    var cols = theProblem.columns.filter(function(c){return c.is_objective;});
    var problem = {
      subject: subject,
      columns: cols
    }
    var body = JSON.stringify(problem);
    console.log(body);
    $.post('/saveProfile', {
      json:true,
      headers: {
        "content-type": "application/json",
      },
      body: body
    })
  }
  //underscore template matching conig
  _.templateSettings = {
      interpolate: /\{\{(.+?)\}\}/g
    };

  /**********START UP**********/
  $(document).ready(function () {
    initColumns();

    $('.input--show-code-btn').addClass('input--show-code-btn_ACTIVE');
    $('.input--show-code-btn_ACTIVE').click(function(){
      $('.input--API').toggleClass('active');
    });

    $('.output--show-code-btn').click(function(){
      $('.output--API').toggleClass('active');
    });

    $('.panel--button').click(analyze);
    $('.auth').click(auth);
    $('.check').click(check);
    $('.save').click(save);
  });

}())
