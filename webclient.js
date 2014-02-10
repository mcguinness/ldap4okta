var RestClient = require('node-rest-client').Client,
    url        = require('url'),
    _          = require('underscore');





function toOrgSchema(org) {
  return {
      objectClass: ['organization', 'top'],
      o: org.subdomain,
      name: org.name,
      url: org.website,
      status: org.status,
      created: org.created,
      lastUpdated: org.lastUpdated
  };
}


function OktaClientError(err) {
  this.name = "OktaClientError";
  this.error = err;
}
OktaResponseError.prototype = new Error();
OktaResponseError.prototype.constructor = OktaClientError;

function OktaResponseError(data, response) {
    this.name = "OktaResponseError";
    this.statusCode = response.statusCode;
    this.message = data.errorSummary || "Unknown";
    this.errorCode = data.errorCode || "E0000000";  
}
OktaResponseError.prototype = new Error();
OktaResponseError.prototype.constructor = OktaResponseError;


// Constructor
function OktaClient(baseUrl, apiToken, schemaMapper) {
  
  var orgSubDomainName = url.parse(baseUrl).host.match(/^(?![0-9]+$)(?!.*-$)(?!-)[a-zA-Z0-9-]{1,63}/)[0];
  var oktaApi = new RestClient();
  var apiHeaders = {
    "Accept":"application/json",
    "Content-Type":"application/json",
    "Authorization": apiToken
  };
  var _schemaMapper = schemaMapper;

  // Add Methods
  oktaApi.registerMethod("createSession", baseUrl + "/api/v1/sessions", "POST");
  oktaApi.registerMethod("getUser", baseUrl + "/api/v1/users/${uid}", "GET");
  oktaApi.registerMethod("getUserGroups", baseUrl + "/api/v1/users/${uid}/groups", "GET");
  oktaApi.registerMethod("getUsers", baseUrl + "/api/v1/users", "GET");
  oktaApi.registerMethod("getGroups", baseUrl + "/api/v1/groups", "GET");
  oktaApi.registerMethod("getGroup", baseUrl + "/api/v1/groups/${gid}", "GET");
  oktaApi.registerMethod("getGroupUsers", baseUrl + "/api/v1/groups/${gid}/users", "GET");
  oktaApi.registerMethod("findUsers", baseUrl + "/api/v1/users", "GET");
  oktaApi.registerMethod("getOrg", baseUrl + "/api/v1/orgs/${subDomain}", "GET");





  this.authenticate = function(userName, password, callback) {
    oktaApi.methods.createSession({
        headers: apiHeaders,
        data: {
          "username": userName,
          "password": password
        }
      }, function(data, response) {
        (response.statusCode == 200) ?
          callback(null) :
          callback(new OktaResponseError(data, response));
      }).on('error', function(err) {
          callback(new OktaClientError(err));
      });
  }

  this.getUserByUid = function (uid, callback) {
    console.log('Finding user: ' + uid);
    oktaApi.methods.getUser({
        path: {"uid": uid },
        headers: apiHeaders
      },
      function(data, response) {
        (response.statusCode == 200) ?
          callback(null, schemaMapper.toUser(JSON.parse(data))) :
          callback(new OktaResponseError(data, response));
      }).on('error', function(err) {
          callback(new OktaClientError(err));
      });
  }

  this.getUsers = function(callback) {
    console.log('Getting all users...');
    oktaApi.methods.getUsers({ 
        headers: apiHeaders 
      }, 
      function(data, response) {
        response.statusCode == 200 ?
          callback(null, _.map(JSON.parse(data), schemaMapper.toUser)) :
          callback(new OktaResponseError(data, response));
      }).on('error',function(err) {
          callback(new OktaClientError(err));
    });
  };


  this.findUsers = function(query, callback) {
    console.log('Finding user that matches prefix: ' + query);
    oktaApi.methods.findUsers({ 
        parameters: {
          q: query
        },
        headers: apiHeaders
      }, 
      function(data, response) {
        response.statusCode == 200 ?
          callback(null, _.map(JSON.parse(data), schemaMapper.toUser)) :
          callback(new OktaResponseError(data, response));
      }).on('error',function(err) {
          callback(new OktaClientError(err));
    });
  };

  this.getGroups = function (callback) {
    console.log("Getting all groups...");
    oktaApi.methods.getGroups({ headers: apiHeaders },
      function(data, response) {
        response.statusCode == 200 ?
          callback(null, _.map(JSON.parse(data), schemaMapper.toGroup)) :
          callback(new OktaResponseError(data, response));
    }).on('error',function(err) {
        callback(new OktaClientError(err));
    });
  };


  this.getGroupById = function(groupId, callback) {
    console.log("Getting group:  " + groupId);
    oktaApi.methods.getGroup({
      path: { "gid": groupId },
      headers: apiHeaders
    }, 
    function(data, response) {
      (response.statusCode == 200) ?
        callback(null, schemaMapper.toGroup(JSON.parse(data))) :
        callback(new OktaResponseError(data, response));
    }).on('error', function(err) {
        callback(new OktaClientError(err));
    });
  };

  this.getUserGroups = function(uid, callback) {
    console.log("Getting groups for user:  " + uid);
    oktaApi.methods.getUserGroups({
      path: {"uid": uid },
      headers: apiHeaders
    }, 
    function(data, response) {
      response.statusCode == 200 ?
        callback(null, _.map(JSON.parse(data), schemaMapper.toGroup)) :
        callback(new OktaResponseError(data, response));
    }).on('error',function(err) {
        callback(new OktaClientError(err));
    });
  };

  this.getGroupUsers = function(groupId, callback) {
    console.log("Getting users for group:  " + groupId);
    oktaApi.methods.getGroupUsers({
      path: { "gid": groupId },
      headers: apiHeaders
    }, 
    function(data, response) {
      response.statusCode == 200 ?
        callback(null, _.map(JSON.parse(data), schemaMapper.toUser)) :
        callback(new OktaResponseError(data, response));
    }).on('error',function(err) {
        callback(new OktaClientError(err));
    });
  };


  this.getOrg = function(callback) {
    console.log('Getting org...');
    oktaApi.methods.getOrg({
      path: { "subDomain": orgSubDomainName },
      headers: apiHeaders
    }, 
    function(data, response) {
      (response.statusCode == 200) ?
        callback(null, schemaMapper.toOrg(JSON.parse(data))) :
        callback(new OktaResponseError(data, response));
    }).on('error', function(err) {
        callback(new OktaClientError(err));
    });;
  };
}

module.exports = OktaClient;
