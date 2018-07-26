module.exports = exports = function apiQueryPlugin(schema) {

    schema.statics.queryBy = function (fnName, rawParams, cb) {
        var model = this
            , params = model.apiQueryParams(rawParams)
            , query = model[fnName](params.searchParams);
        if (params.per_page) {
            params.per_page = parseInt(params.per_page)
            query.limit(params.per_page).skip((params.page - 1) * params.per_page)
        }
        if (params.sort) {
            query = query.sort(params.sort);
        }
        return cb ? query.exec(cb) : query;
    };

    schema.statics.apiQuery = function (rawParams, cb) {
        var model = this
            , params = model.apiQueryParams(rawParams)
            , query = model.find(params.searchParams);

        if (params.per_page) {
            params.per_page = parseInt(params.per_page)
            query.limit(params.per_page).skip((params.page - 1) * params.per_page)
        }
        if (params.sort) {
            query = query.sort(params.sort);
        }

        return cb ? query.exec(cb) : query;
    };

    schema.statics.apiQueryParams = function (rawParams) {

        var model = this;

        var convertToBoolean = function (str) {
            return (["true", "t", "yes", "y"].indexOf(str.toLowerCase()) !== -1)
        };

        var searchParams = {}
            , page = 1
            , per_page = 10
            , sort = false;

        var parseSchemaForKey = function (schema, keyPrefix, lcKey, val, operator) {

            var paramType = false
                , matches
                , constructorName
                , pathKey
                , nameMatch
                , newParam
                , latlng;

            var addSearchParam = function (val) {
                var key = keyPrefix + lcKey;
                if (typeof searchParams[key] !== 'undefined') {
                    for (i in val) {
                        searchParams[key][i] = val[i];
                    }
                } else {
                    searchParams[key] = val;
                }
            };

            if (matches = lcKey.match(/(.+)\.(.+)/)) {
                // parse subschema
                pathKey = schema.paths[matches[1]];
                constructorName = pathKey.constructor.name;

                if (["DocumentArray", "Mixed"].indexOf(constructorName) !== -1) {
                    parseSchemaForKey(pathKey.schema, matches[1] + ".", matches[2], val, operator)
                }
            } else if (typeof schema === "undefined") {
                paramType = "String";

            } else if (typeof schema.paths[lcKey] === "undefined") {
                // nada, not found

            } else if (operator === "near") {
                paramType = "Near";
            } else {
                constructorName = schema.paths[lcKey].constructor.name;
                nameMatch = {
                    "SchemaBoolean": "Boolean",
                    "SchemaString":  "String",
                    "ObjectId":      "ObjectId",
                    "SchemaDate":    "Date"
                };
                paramType = nameMatch[constructorName] || false
            }

            if (paramType === "Boolean") {
                addSearchParam(convertToBoolean(val));
            } else if (paramType === "Number") {
                if (val.match(/([0-9]+,?)/) && val.match(',')) {
                    if (operator === "all") {
                        addSearchParam({$all: val.split(',')});
                    } else if (operator === "nin") {
                        addSearchParam({$nin: val.split(',')});
                    } else if (operator === "mod") {
                        addSearchParam({$mod: [val.split(',')[0], val.split(',')[1]]});
                    } else {
                        addSearchParam({$in: val.split(',')});
                    }
                } else if (val.match(/([0-9]+)/)) {
                    if (["gt", "gte", "lt", "lte", "ne"].indexOf(operator) != -1) {
                        newParam = {};
                        newParam["$" + operator] = val;
                        addSearchParam(newParam);
                    } else {
                        addSearchParam(parseInt(val));
                    }
                }
            } else if (paramType === "String") {
                if (val.match(',')) {
                    var options = val.split(',').map(
                        function (str) {
                            return new RegExp(str, 'i');
                        }
                    );

                    if (operator === "all") {
                        addSearchParam({$all: options});
                    } else if (operator === "nin") {
                        addSearchParam({$nin: options});
                    } else {
                        addSearchParam({$in: options});
                    }
                } else if (val.match(/^[0-9]+$/)) {
                    if (operator === "gt" ||
                        operator === "gte" ||
                        operator === "lt" ||
                        operator === "lte") {
                        newParam = {};
                        newParam["$" + operator] = val;
                        addSearchParam(newParam);
                    } else {
                        addSearchParam(val);
                    }
                } else if (operator === "ne" || operator === "not") {
                    addSearchParam({'$not': new RegExp(val, "i")});
                } else if (operator === "exact") {
                    addSearchParam(val);
                } else {
                    addSearchParam({$regex: val, $options: "-i"});
                }
            } else if (paramType === "Near") {
                // divide by 69 to convert miles to degrees
                latlng = val.split(',');
                newParam = {$near: [parseFloat(latlng[0]), parseFloat(latlng[1])]};
                if (typeof latlng[2] !== 'undefined') {
                    newParam.$maxDistance = parseFloat(latlng[2]) / 69;
                }
                addSearchParam(newParam);
            } else if (paramType === "ObjectId") {
                addSearchParam(val);
            } else if (paramType === "Date") {
                if (operator === "gt" ||
                    operator === "gte" ||
                    operator === "lt" ||
                    operator === "lte") {
                    newParam = {};
                    newParam["$" + operator] = new Date(val);
                    addSearchParam(newParam);
                }
            }

        };

        var parseParam = function (key, val) {
            var lcKey = key
                , operator = val.match(/\{(.*)\}/);

            val = val.replace(/{(.*)}/, '');

            if (operator) {
                operator = operator[1];
            }

            if (val === "") {
                return;
            } else if (lcKey === "page") {
                page = val;
            } else if (lcKey === "per_page") {
                per_page = val;
            } else if (lcKey === "sort_by") {
                var parts = val.split(',');
                sort = {};
                sort[parts[0]] = parts.length > 1 ? parts[1] : 1;
            } else {
                parseSchemaForKey(model.schema, "", lcKey, val, operator);
            }
        };

        // Construct searchParams
        for (var key in rawParams) {
            if (key === '__proto__') {
                continue;
            }
            var separatedParams
            try {
                separatedParams = rawParams[key].match(/\{\w+\}(.[^\{\}]*)/g);
            } catch (error) {
                throw new Error('[mongoose-api-query] rawParams[key].match - rawParams: ' + JSON.stringify(rawParams) + ' - key: ' + key);
            }


            if (separatedParams === null) {
                parseParam(key, rawParams[key]);
            } else {
                for (var i = 0, len = separatedParams.length; i < len; ++i) {
                    parseParam(key, separatedParams[i]);
                }
            }
        }

        return {
            searchParams: searchParams,
            page:         page,
            per_page:     per_page,
            sort:         sort
        };

    };

};
