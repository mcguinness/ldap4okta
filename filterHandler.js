var ldap       = require('ldapjs'),
    _          = require('underscore'),
    url        = require('url'),
    deferred   = require('deferred');

var FilterHandler = function() {
  var self = this;

  this.queryPlan = {
    users: {
      objectClass: ['okta-user', 'user', 'inetorgperson'],
      list: false,
      query: [],
      queryAttributes: ['givenname', 'sn', 'email', 'cn'],
      id: [],
      idAttributes: ['id', 'uid', 'login', 'cn']
    },
    groups: {
      objectClass: ['okta-group', 'group'],
      list: false,
      query: [],
      queryAttributes: ['name', 'cn'],
      id: [],
      idAttributes: ['id', 'gid', 'cn']
    }
  }

  function parseSingleFilter(f, qp) {
    console.log("processing filter: " + f.toString());
    if (self.constructor.isObjectClass(f, qp.users.objectClass)) {
      qp.users.list = true;
    } else if (self.constructor.isObjectClass(f, qp.groups.objectClass)) {
      qp.groups.list = true;
    } else if (self.constructor.isQuery(f, qp.users.queryAttributes)) {
			if (_.indexOf(qp.users.query, f.initial) < 0) {
				qp.users.query.push(f.initial);
			} 
		} else if (self.constructor.isEquals(f, qp.users.idAttributes)) {
			if (_.indexOf(qp.users.id, f.value) < 0) {
				qp.users.id.push(f.value);
			}
    }
  }

  function parseAndFilter(andFilter, qp) {
    console.log("processing 'and' filter: " + andFilter.toString());
    if (andFilter.type === 'and') {
      // (&(objectClass=x)(attribute=y))
      if (andFilter.filters.length == 2) {
        if (self.constructor.isObjectClass(andFilter.filters, qp.users.objectClass)) {
          _.each(andFilter.filters, function(f) {
            console.log("processing filter: " + f.toString());
            if (self.constructor.isQuery(f, qp.users.queryAttributes)) {
              if (_.indexOf(qp.users.query, f.initial) < 0) {
                qp.users.query.push(f.initial);
              }
            } else if (self.constructor.isEquals(f, qp.users.idAttributes)) {
              if (_.indexOf(qp.users.id, f.value) < 0) {
                qp.users.id.push(f.value);
              }
            }
          });
        } else if (self.constructor.isObjectClass(andFilter.filters, qp.groups.objectClass)) {
          _.each(andFilter.filters, function(f) {
            console.log("processing filter: " + f.toString());
            if (self.constructor.isQuery(f, qp.groups.queryAttributes)) {
              if (_.indexOf(qp.groups.query, f.initial) < 0) {
                qp.groups.query.push(f.initial);
              }
            } else if (self.constructor.isEquals(f, qp.groups.idAttributes)) {
              if (_.indexOf(qp.groups.id, f.value) < 0) {
                qp.groups.id.push(f.value);
              }
            }
          });
        }
      }
    }
  }

  function parseOrFilter(orFilter, qp) {
    console.log("processing 'or' filter: " + orFilter.toString());
    if (orFilter.type === 'or') {
      _.each(orFilter.filters, function(f) {
        parseSingleFilter(f, qp);
      });
    }
  }

  function parseFilter(filter, qp) {
    if (filter.type === 'and') {
      if (filter.filters.length == 1 && filter.filters[0].type === 'or') {
        parseOrFilter(filter.filters[0], qp);
      } else {
        parseAndFilter(filter, qp) 
      }
    } else if (filter.type === 'or') {
      parseOrFilter(filter, qp);
    } else {
      parseSingleFilter(filter, qp);
    }
  }

  this.execute = function(filter, oktaClient, callback) {

    parseFilter(filter, this.queryPlan);
    console.log(this.queryPlan);

    var promises = [];
    var delayGetUsers = deferred.promisify(oktaClient.getUsers);
    var delayGetGroups = deferred.promisify(oktaClient.getGroups);
    var delayFindUsers = deferred.promisify(oktaClient.findUsers);
    var delayGetUserByUid = deferred.promisify(oktaClient.getUserByUid);

    if (this.queryPlan.users.list && this.queryPlan.users.list) {
      deferred(delayGetUsers(), delayGetGroups())
        .then(function (results) {
          callback(null, results);
        }, function (err) {
          callback(err);
        });
    } else {
      if (this.queryPlan.users.list) {
        promises.push(delayGetUsers());
      } else {
        _.each(_.uniq(self.queryPlan.users.query), function(query) {
          promises.push(delayFindUsers(query));
        });
        _.each(_.uniq(self.queryPlan.users.id), function(id) {
          promises.push(delayGetUserByUid(id));
        });
      }

      if (this.queryPlan.groups.list) {
        promises.push(delayGetGroups());
      };
      
      deferred.map(promises, function(promise) {
        return promise;
      }).then(function (results) {
        callback(null, results);
      }, function (err) {
        callback(err);
      });
    }
  }
};

FilterHandler.isObjectClass = function(filter, objectClass) {
  var targetClasses = _.isArray(objectClass) ? objectClass : [objectClass];
  var filters = _.isArray(filter) ? filter : [filter];

  for (var i=0; i<filters.length; i++) {
    f = filters[i];
    if (f.type && f.attribute && f.attribute.toLowerCase() === 'objectclass') {
      if (f.type === 'present') { 
        return true; 
      }
      else if (f.type === 'equal' && f.value) {
        return _.some(targetClasses, function(objectClass) {
          return f.value.toLowerCase() === objectClass.toLowerCase();
        });
      }
    }
  }

  return false;
}

FilterHandler.isQuery = function(filter, queryAttrs) {
  queryAttrs = _.isArray(queryAttrs) ? queryAttrs : [queryAttrs];
  return filter.type === 'substring' && filter.attribute &&
    _.some(queryAttrs, function(attr) {
      return filter.attribute.toLowerCase() === attr.toLowerCase();
    });
}

FilterHandler.isEquals = function(filter, attrs) {
  attrs = _.isArray(attrs) ? attrs : [attrs];
  return filter.type === 'equal' && filter.attribute &&
    _.some(attrs, function(attr) {
      return filter.attribute.toLowerCase() === attr.toLowerCase();
    });
}

module.exports = FilterHandler;