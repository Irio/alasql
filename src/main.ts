//! AlaSQL vPACKAGE_VERSION_NUMBER | © 2014-2018 Andrey Gershun & Mathias Rangel Wulff | License: MIT
/**
@module alasql
@version PACKAGE_VERSION_NUMBER

AlaSQL - JavaScript SQL database
© 2014-2018	Andrey Gershun & Mathias Rangel Wulff

@license
The MIT License (MIT)

Copyright 2014-2016 Andrey Gershun (agershun@gmail.com) & Mathias Rangel Wulff (m@rawu.dk)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import addOptions from './options';

import grammar from './alasqlparser';

import expandGrammar from './expandGrammar';

import alasqlObj from '../alasqlObj';

import addUtils from './utils';

import addLogic from './utils';

import addDataStruct from './dataStruct';

/**
	AlaSQL - Main Alasql class
 	@function
 	@param {string|function|object} sql - SQL-statement or data object for fuent interface
 	@param {object} params - SQL parameters
 	@param {function} cb - callback function
 	@param {object} scope - Scope for nested queries
 	@return {any} - Result data object

	@example
 Standard sync call:
    alasql('CREATE TABLE one');
 Query:
 	var res = alasql('SELECT * FROM one');
 Call with parameters:
 	var res = alasql('SELECT * FROM ?',[data]);
 Standard async call with callback function:
 	alasql('SELECT * FROM ?',[data],function(res){
		console.log(data);
 	});
 Call with scope for subquery (to pass common values):
    var scope = {one:{a:2,b;20}}
    alasql('SELECT * FROM ? two WHERE two.a = one.a',[data],null,scope);
 Call for fluent interface with data object:
    alasql(data).Where(function(x){return x.a == 10}).exec();
 Call for fluent interface without data object:
    alasql().From(data).Where(function(x){return x.a == 10}).exec();
 */

//const logic: {[key: string]: any} = {};

let alasql: any = () => {};

const mem: {[key: string]: any} = {grammar, alasql};

mem.alasql = alasqlObj(mem);

mem.alasql.version = 'PACKAGE_VERSION_NUMBER';

mem.alasql.debug = false;

expandGrammar(mem);

addOptions(mem);

addUtils(mem);

addDataStruct(mem);

addLogic(mem);

addHelperFunc(mem);



mem.alasql.path = mem.utils.findAlaSQLPath();

/*only-for-browser/*
//!var require = function(){return null}; // as alasqlparser.js is generated, we can not "remove" referenses to 
//!var __dirname = '';
//*/

/*only-for-browser/*
if(utils.isCordova || utils.isMeteorServer || utils.isNode ){
  console.warn('It looks like you are using the browser version of AlaSQL. Please use the alasql.fs.js file instead.')
}
//*/

// Create default database
new mem.alasql.Database('alasql');

// Set default database
mem.alasql.use('alasql');

export default mem.alasql;