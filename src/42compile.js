// SELECT Compile functions

function returnTrue () {return true};

yy.Select.prototype.compileJoins = function(query) {
//	console.log(this.join);
	var self = this;
	this.joins.forEach(function(jn){
		var tq = jn.table;
		var source = {
			alias: tq.alias||tq.tableid,
			databaseid: jn.databaseid || query.database.databaseid,
			tableid: tq.tableid,
			joinmode: jn.joinmode,
			onmiddlefn: returnTrue,
			wherefns: '',	// for optimization
			wherefn: returnTrue
		};

		var alias = tq.as || tq.tableid;
		query.aliases[alias] = {tableid: tq.tableid, databaseid: tq.databaseid || query.database.databaseid};

		if(jn.using) {
			var prevSource = query.sources[query.sources.length-1];
//			console.log(query.sources[0],prevSource,source);
			source.onleftfns = jn.using.map(function(colid){
				return "p['"+(prevSource.alias||prevSource.tableid)+"']['"+colid+"']";
			}).join('+"`"+');
			source.onleftfn = new Function('p,params','return '+source.onleftfns);
			source.onrightfns = jn.using.map(function(colid){
				return "p['"+(source.alias||source.tableid)+"']['"+colid+"']";
			}).join('+"`"+');
			source.onrightfn = new Function('p,params','return '+source.onrightfns);
			source.optimization = 'ix';
		} else if(jn.on) {
//console.log(jn.on);
			if(jn.on instanceof yy.Op && jn.on.op == '=') {
//				console.log('ix optimization', jn.on.toJavaScript('p',query.defaultTableid) );
				source.optimization = 'ix';
			// 	source.onleftfns = jn.on.left.toJavaScript('p',query.defaultTableid);
			// 	source.onleftfn = new Function('p', 'return '+source.onleftfns);
			// 	source.onrightfns = jn.on.right.toJavaScript('p',query.defaultTableid);
			// 	source.onrightfn = new Function('p', 'return '+source.onrightfns);

				var lefts ;
				var rights ;
				var middles ;
				// Test right and left sides
				var ts = jn.on.left.toJavaScript('p',query.defaultTableid);
				var rs = jn.on.right.toJavaScript('p',query.defaultTableid);
				if((ts.indexOf("p['"+alias+"']")>-1) && !(rs.indexOf("p['"+alias+"']")>-1)){
					rights = ts;
				} else 	if(!(ts.indexOf("p['"+alias+"']")>-1) && (rs.indexOf("p['"+alias+"']")>-1)){
					lefts = ts;
				} else {
					middles = ts;
				}

				if((rs.indexOf("p['"+alias+"']")>-1) && !(ts.indexOf("p['"+alias+"']")>-1)){
					rights = rs;
				} else if(!(rs.indexOf("p['"+alias+"']")>-1) && (ts.indexOf("p['"+alias+"']")>-1)){
					lefts = rs;
				} else {
					if(middles) {
						middles = jn.on.toJavaScript('p',query.defaultTableid);
					} else {
						rights = '';
						lefts = '';
						middles = jn.on.toJavaScript('p',query.defaultTableid);
						source.optimization = 'no';
						// What to here?
					} 
				}

				source.onleftfns = lefts;
				source.onrightfns = rights;
				source.onmiddlefns = middles || 'true';
//			console.log(source.onleftfns, '-',source.onrightfns, '-',source.onmiddlefns);

				source.onleftfn = new Function('p,params', 'return '+source.onleftfns);
				source.onrightfn = new Function('p,params', 'return '+source.onrightfns);
				source.onmiddlefn = new Function('p,params', 'return '+source.onmiddlefns);

//			} else if(jn.on instanceof yy.Op && jn.on.op == 'AND') {
//				console.log('join on and ',jn);

			} else {
//				console.log('no optimization');
				source.optimization = 'no';
//				source.onleftfn = returnTrue;
//				source.onleftfns = "true";
				source.onmiddlefns = jn.on.toJavaScript('p',query.defaultTableid);
				source.onmiddlefn = new Function('p,params','return '+jn.on.toJavaScript('p',query.defaultTableid));
			};
//			console.log(source.onleftfns, source.onrightfns, source.onmiddlefns);

			// Optimization function
		};

//		source.data = alasql.databases[source.databaseid].tables[source.tableid].data;
//console.log(source, jn);
		// TODO SubQueries
		if(!query.database.tables[source.tableid]) {
			throw new Error('Table \''+source.tableid+
			'\' is not exists in database \''+query.database.databaseid)+'\'';
		};
		source.data = query.database.tables[source.tableid].data;
		if(source.joinmode == 'RIGHT') {
			var prevSource = query.sources.pop();
			if(prevSource.joinmode == 'INNER') {
				prevSource.joinmode = 'LEFT';
				var onleftfn = prevSource.onleftfn;
				var onleftfns = prevSource.onleftfns;
				var onrightfn = prevSource.onrightfn;
				var onrightfns = prevSource.onrightfns;
				var optimization = prevSource.optimization;

				prevSource.onleftfn = source.onrightfn;
				prevSource.onleftfns = source.onrightfns;
				prevSource.onrightfn = source.onleftfn;
				prevSource.onrightfns = source.onleftfns;
				prevSource.optimization = source.optimization;

				source.onleftfn = onleftfn;
				source.onleftfns = onleftfns;
				source.onrightfn = onrightfn;
				source.onrightfns = onrightfns;
				source.optimization = optimization;

				source.joinmode = 'INNER';
				query.sources.push(source);
				query.sources.push(prevSource);
			} else {
				throw new Error('Do not know how to process this SQL');
			}
		} else {
			query.sources.push(source);
		}
	});
//	console.log('sources',query.sources);
}

yy.Select.prototype.compileGroup = function(query) {


	var self = this;
	var s = 'var g=this.xgroups[';

//	var gcols = this.group.map(function(col){return col.columnid}); // Group fields with r

	// Array with group columns from record
//	var rg = gcols.map(function(columnid){return 'r.'+columnid});
	var rg = this.group.map(function(col){
		if(col == '') return '1';
//		console.log(col.toJavaScript('r',''));
//		console.log(col, col.toJavaScript('r',''));
		else return col.toJavaScript('r','');
	});

//	console.log('rg',rg);

	s += rg.join('+"`"+');
	s += '];if(!g) {this.groups.push(g=this.xgroups[';
	s += rg.join('+"`"+');
//	s += '] = {';
	s += ']=r';

	// columnid:r.columnid
	var srg = [];//rg.map(function(fn){ return (fn+':'+fn); });

//	var srg = this.group.map(function(col){
//		if(col == '') return '';
//		else return col.columnid+':'+col.toJavaScript('r','');
//	});

// Initializw aggregators

/*
	this.columns.forEach(function(col){
//		console.log(f);
//			if(f.constructor.name == 'LiteralValue') return '';


		if (col instanceof yy.AggrValue) { 
			if (col.aggregatorid == 'SUM') { srg.push("'"+col.as+'\':0'); }//f.field.arguments[0].toJavaScript(); 	
			else if(col.aggregatorid == 'COUNT') {srg.push( "'"+col.as+'\':0'); }
			else if(col.aggregatorid == 'MIN') { srg.push( "'"+col.as+'\':Infinity'); }
			else if(col.aggregatorid == 'MAX') { srg.push( "'"+col.as+'\':-Infinity'); }
//			else if(col.aggregatorid == 'AVG') { srg.push(col.as+':0'); }
//				return 'group.'+f.name.value+'=+(+group.'+f.name.value+'||0)+'+f.field.arguments[0].toJavaScript('rec','')+';'; //f.field.arguments[0].toJavaScript(); 	
		};

	});

*/

/*****************/

//	s += srg.join(',');

	// var ss = [];
	// gff.forEach(function(fn){
	// 	ss.push(fn+':rec.'+fn);
	// });
	// s += ss.join(',');
//	s += '});};';

	s += ');} else {';
//	console.log(s, this.columns);

//console.log(query.selectfn);
	s += this.columns.map(function(col){
		if (col instanceof yy.AggrValue) { 
			if (col.aggregatorid == 'SUM') { return 'g[\''+col.as+'\']+=r[\''+col.as+'\'];'; }//f.field.arguments[0].toJavaScript(); 	
			else if(col.aggregatorid == 'COUNT') { return 'g[\''+col.as+'\']++;'; }
			else if(col.aggregatorid == 'MIN') { return 'g[\''+col.as+'\']=Math.min(g[\''+col.as+'\'],r[\''+col.as+'\']);'; }
			else if(col.aggregatorid == 'MAX') { return 'g[\''+col.as+'\']=Math.max(g[\''+col.as+'\'],r[\''+col.as+'\']);'; }
//			else if(col.aggregatorid == 'AVG') { srg.push(col.as+':0'); }
			return '';
		} else return '';
	}).join('');


//	s += selectFields.map(function(f){
//			console.log(f);
//			if(f.constructor.name == 'LiteralValue') return '';
//			if (f.field instanceof SQLParser.nodes.FunctionValue 
//				&& (f.field.name.toUpperCase() == 'SUM' || f.field.name.toUpperCase() == 'COUNT')) {
//				return 'group.'+f.name.value+'=+(+group.'+f.name.value+'||0)+'+f.field.arguments[0].toJavaScript('rec','')+';'; //f.field.arguments[0].toJavaScript(); 	
//				return 'group.'+f.name.value+'+='+f.field.arguments[0].toJavaScript('rec','')+';'; //f.field.arguments[0].toJavaScript(); 	
//				return 'group.'+f.name.value+'+=rec.'+f.name.value+';'; //f.field.arguments[0].toJavaScript(); 	
//			};
//			return '';
//		}).join('');

	//s += '	group.amt += rec.emplid;';
	//s += 'group.count++;';

	s += '}';
//	console.log(s, this.group);

//	console.log(query);
	return new Function('r,params',s);

}

yy.Select.prototype.compileFrom = function(query) {
	var self = this;
	query.sources = [];
//	var tableid = this.from[0].tableid;
//	var as = '';
//	if(self.from[0].as) as = this.from[0].as;
//console.log(this);
	query.defaultTableid = this.from[0].tableid;
	query.aliases = {};
	self.from.forEach(function(tq){
		var alias = tq.as || tq.tableid;
		query.aliases[alias] = {tableid: tq.tableid, databaseid: tq.databaseid || query.database.databaseid};

		var source = {
			alias: alias,
			databaseid: tq.databaseid || query.database.databaseid,
			tableid: tq.tableid,
			joinmode: 'INNER',
			onmiddlefn: returnTrue,			
			wherefns: '',	// for optimization
			wherefn: returnTrue			
		};
//		source.data = alasql.databases[source.databaseid].tables[source.tableid].data;
		query.sources.push(source);

	});
	// TODO Add joins
};

// yy.Select.prototype.compileSources = function(query) {
// 	return sources;
// };

function compileSelectStar (query,alias) {
	// console.log(query.aliases[alias]);
//	console.log(query,alias);
	// console.log(query.aliases[alias].tableid);
	var s = '', sp = '', ss=[];
	var columns = query.database.tables[query.aliases[alias].tableid].columns;
	if(columns) {
		columns.forEach(function(tcol){
			ss.push(tcol.columnid+':p.'+alias+'.'+tcol.columnid);

//		console.log('ok',s);

			var coldef = {
				columnid:tcol.columnid, 
				dbtypeid:tcol.dbtypeid, 
				dbsize:tcol.dbsize, 
				dbpecision:tcol.dbprecision
			};
			query.columns.push(coldef);
			query.xcolumns[coldef.columnid]=coldef;

		});
	} else {
		// if column not exists, then copy all
		sp += 'var w=p["'+alias+'"];for(var k in w){r[k]=w[k]};';
		query.dirtyColumns = true;
	}
	return {s:ss.join(','),sp:sp};
}


yy.Select.prototype.compileSelect = function(query) {
	var self = this;
	query.columns = [];
	query.xcolumns = {};
	query.dirtyColumns = false;
	var s = 'var r={';
	var sp = '';
	var ss = [];
//	console.log(this.columns);
	this.columns.forEach(function(col){
		if(col instanceof yy.Column) {
			if(col.columnid == '*') {
				if(col.tableid) {
					//Copy all
					var ret = compileSelectStar(query, col.tableid);
					if(ret.s)  ss = ss.concat(ret.s);
					sp += ret.sp;

				} else {
					for(var alias in query.aliases) {
						var ret = compileSelectStar(query, alias); //query.aliases[alias].tableid);
						if(ret.s) ss = ss.concat(ret.s);
						sp += ret.sp;
					}
					// TODO Remove these lines
					// In case of no information 
					// sp += 'for(var k1 in p){var w=p[k1];'+
					// 			'for(k2 in w) {r[k2]=w[k2]}}'
				}
			} else {
				// If field, otherwise - expression
				ss.push((col.as || col.columnid)+':p.'+(col.tableid||query.defaultTableid)+'.'+col.columnid);

				if(!query.aliases[col.tableid||query.defaultTableid]) {
					throw new Error('There is now such table \''+col.tableid+'\'');
				};
				var xcolumns = query.database.tables[query.aliases[col.tableid||query.defaultTableid].tableid].xcolumns;

				if(xcolumns) {
					var tcol = xcolumns[col.columnid];
					var coldef = {
						columnid:col.as || col.columnid, 
						dbtypeid:tcol.dbtypeid, 
						dbsize:tcol.dbsize, 
						dbpecision:tcol.dbprecision
					};
					query.columns.push(coldef);
					query.xcolumns[coldef.columnid]=coldef;
				} else {
					query.dirtyColumns = true;
				}

			}
		} else if(col instanceof yy.AggrValue) {
			if(!self.group) {
//				self.group=[new yy.Column({columnid:'q',as:'q'	})];
				self.group = [''];
			}
			if(!col.as) col.as = col.toString();
			if (col.aggregatorid == 'SUM' || col.aggregatorid == 'MAX' ||  col.aggregatorid == 'MIN' ) {
				ss.push("'"+col.as+'\':'+col.expression.toJavaScript("p",query.defaultTableid))	
			} else if (col.aggregatorid == 'COUNT') {
				ss.push("'"+col.as+"':1");
				// Nothing
			} 
//			else if (col.aggregatorid == 'MAX') {
//				ss.push((col.as || col.columnid)+':'+col.toJavaScript("p.",query.defaultTableid))
//			} else if (col.aggregatorid == 'MIN') {
//				ss.push((col.as || col.columnid)+':'+col.toJavaScript("p.",query.defaultTableid))
//			}
		} else {
			ss.push((col.as || col.columnid)+':'+col.toJavaScript("p.",query.defaultTableid));
			//if(col instanceof yy.Expression) {
		}
	});
	s += ss.join(',')+'};'+sp;
//	console.log(s);
	query.selectfns = s;
	return new Function('p,params',s+'return r');
};

yy.Select.prototype.compileWhere = function(query) {
	if(this.where) {
		s = this.where.toJavaScript('p',query.defaultTableid);
		query.wherefns = s;
//		console.log(s);
		return new Function('p,params','return '+s);
	} else return function(){return true};
};

yy.Select.prototype.compileWhereJoins = function(query) {
//	console.log(this.where);
	optimizeWhereJoin(query, this.where.expression);

	//for sources compile wherefs
	query.sources.forEach(function(source) {
		if(source.wherefns) {
			source.wherefn = new Function('p,params','return '+source.wherefns);
		};
		if(source.wxleftfns) {
			source.wxleftfn = new Function('p,params','return '+source.wxleftfns);
		};
		if(source.wxrightfns) {
			source.wxrightfn = new Function('params','return '+source.wxrightfns);
		};
//		console.log(source.alias, source.wherefns)
//		console.log(source);
	});
};

function optimizeWhereJoin (query, ast) {
	var s = ast.toJavaScript('p',query.defaultTableid);
	var fsrc = [];
	query.sources.forEach(function(source,idx) {
		if(s.indexOf('p[\''+source.alias+'\']')>-1) fsrc.push(source);
	});
//	console.log(ast);
//	console.log(s);
//	console.log(fsrc.length);
	if(fsrc.length == 0) {
//		console.log('no optimization, can remove this part of ast');
		return;
	} else if (fsrc.length == 1) {
		var src = fsrc[0]; // optmiization source
		src.wherefns = src.wherefns ? src.wherefns+'&&'+s : s;

		if((ast instanceof yy.Op) && (ast.op == '=')) {
			if(ast.left instanceof yy.Column) {
				var ls = ast.left.toJavaScript('p',query.defaultTableid);
				var rs = ast.right.toJavaScript('p',query.defaultTableid);
				if(rs.indexOf('p[\''+fsrc[0].alias+'\']') == -1) {
					fsrc[0].wxleftfns = ls; 
					fsrc[0].wxrightfns = rs; 
				} 
			} if(ast.right instanceof yy.Column) {
				var ls = ast.left.toJavaScript('p',query.defaultTableid);
				var rs = ast.right.toJavaScript('p',query.defaultTableid);
				if(ls.indexOf('p[\''+fsrc[0].alias+'\']') == -1) {
					fsrc[0].wxleftfns = rs; 
					fsrc[0].wxrightfns = ls; 
				} 
			}
		}
		return;
	} else {
		if(ast.op = 'AND') {
			optimizeWhereJoin(query,ast.left);
			optimizeWhereJoin(query,ast.right);
		} 
	}

};


yy.Select.prototype.compileOrder = function (query) {
	if(this.order) {
		var s = '';
		var sk = '';
		this.order.forEach(function(ord){
			var columnid = ord.expression.columnid; 
			
			// Date conversion
			var dg = ''; 
			if(query.xcolumns[columnid]) {
				var dbtypeid = query.xcolumns[columnid].dbtypeid;
				if( dbtypeid == 'DATE' || dbtypeid == 'DATETIME') dg = '+';
			}
			
			// COLLATE NOCASE
			if(ord.nocase) columnid += '.toUpperCase()';

			// TODO Add date comparision
			s += 'if('+dg+'a.'+columnid+(ord.direction == 'ASC'?'>':'<')+dg+'b.'+columnid+')return 1;';
			s += 'if('+dg+'a.'+columnid+'=='+dg+'b.'+columnid+'){';
			sk += '}';
		});
		s += 'return 0;';
		s += sk+'return -1';
		query.orderfns = s;

		return new Function('a,b',s);
	};
};

