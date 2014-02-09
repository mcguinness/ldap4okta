var RestClient = require('node-rest-client').Client,
    url        = require('url'),
    _          = require('underscore');



function toUserSchema(user) {
  return {
      objectClass: ['okta-user', 'user', 'inetorgperson', 'organizationalperson', 'person', 'top'],
      sn: user['profile']['lastName'],
      givenName: user['profile']['firstName'],
      mail: user['profile']['email'],
      mobile: user['profile']['mobilePhone'],
      uid: user['profile']['login'],
      title: user['profile']['title'],
      manager: user['profile']['manager'],
      physicalDeliveryOfficeName: user['profile']['location'],
      uuid: user['id']
  };
}

function toGroupSchema(group) {
  return {
      objectClass: ['okta-group', 'group', 'top'],
      name: group.profile.name,
      description: group.profile.description,
      gid: group.id
  };
}


function OktaClientError(data, response) {
    var ex;
    this.name = "OktaClient";
    this.statusCode = response.statusCode;
    console.log(response);

    console.log(data);

    if (data !== 'undefined') {
      ex = JSON.parse(data);
      this.message = ex.errorSummary || "Unknown";
      this.errorCode = ex.errorCode || "E0000000";
    }
}
OktaClientError.prototype = new Error();
OktaClientError.prototype.constructor = OktaClient;



// Constructor
function OktaClient(baseUrl, apiToken) {
  
  var orgName = url.parse(baseUrl).host.match(/^(?![0-9]+$)(?!.*-$)(?!-)[a-zA-Z0-9-]{1,63}/)[0];
  var oktaApi = new RestClient();
  var apiHeaders = {
    "Accept":"application/json",
    "Content-Type":"application/json",
    "Authorization": apiToken
  };

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


  this.authenticate = function(userName, password, onSuccess, onError) {
    oktaApi.methods.createSession({
        headers: apiHeaders,
        data: {
          "username": userName,
          "password": password
        }
      }, function(data, response) {
        (response.statusCode == 200) ?
          onSuccess() :
          onError(new OktaClientError(data, response));
      }).on('error', function(err) {
          onError();
      });
  }

  this.getUserByUid = function (uid, onSuccess, onError) {
    console.log('Finding user: ' + uid);
    oktaApi.methods.getUser({
        path: {"uid": uid },
        headers: apiHeaders
      },
      function(data, response) {
        (response.statusCode == 200) ?
          onSuccess(toUserSchema(JSON.parse(data))) :
          onError(new OktaClientError(data, response));
      }).on('error', function(err) {
          console.log('something went wrong on the request', err.request.options);
          onError();
      });
  }

  this.getUsers = function(onSuccess, onError) {
    console.log('Getting all users...');
    oktaApi.methods.getUsers({ 
        headers: apiHeaders 
      }, 
      function(data, response) {
        if (response.statusCode == 200) {
            onSuccess(_.map(JSON.parse(data), toUserSchema));
        } else {
          onError(new OktaClientError(data, response));
        }
      }).on('error',function(err) {
          console.log('something went wrong on the request', err.request.options);
          onError();
    });
  };


  this.findUsers = function(query, onSuccess, onError) {
    console.log('Finding user that matches prefix: ' + query);
    oktaApi.methods.findUsers({ 
        parameters: {
          q: query
        },
        headers: apiHeaders
      }, 
      function(data, response) {
        if (response.statusCode == 200) {
            onSuccess(_.map(JSON.parse(data), toUserSchema));
        } else {
          onError(new OktaClientError(data, response));
        }
      }).on('error',function(err) {
          console.log('something went wrong on the request', err.request.options);
          onError();
    });
  };

  this.getGroups = function (onSuccess, onError) {
    console.log("Getting all groups...");
    oktaApi.methods.getGroups({ headers: apiHeaders },
      function(data, response) {
        if (response.statusCode == 200) {
            onSuccess(_.map(JSON.parse(data), toGroupSchema));
        } else {
          onError(new OktaClientError(data, response));
        }
      }).on('error',function(err) {
          console.log('something went wrong on the request', err.request.options);
    });
  };


  this.getGroupById = function(groupId, onSuccess, onError) {
    console.log("Getting group:  " + groupId);
    oktaApi.methods.getGroup({
      path: { "gid": groupId },
      headers: apiHeaders
    }, 
    function(data, response) {
      (response.statusCode == 200) ?
        onSuccess(toGroupSchema(JSON.parse(data))) :
        onError(new OktaClientError(data, response));
    }).on('error',function(err) {
        console.log('something went wrong on the request', err.request.options);
        onError();
    });
  };

  this.getUserGroups = function(uid, onSuccess, onError) {
    console.log("Getting groups for user:  " + uid);
    oktaApi.methods.getUserGroups({
      path: {"uid": uid },
      headers: apiHeaders
    }, 
    function(data, response) {
      if (response.statusCode == 200) {
          onSuccess(_.map(JSON.parse(data), toGroupSchema));
      } else {
        onError(new OktaClientError(data, response));
      }
    }).on('error',function(err) {
        console.log('something went wrong on the request', err.request.options);
        onError();
    });
  };

  this.getGroupUsers = function(groupId, onSuccess, onError) {
    console.log("Getting users for group:  " + groupId);
    oktaApi.methods.getGroupUsers({
      path: { "gid": groupId },
      headers: apiHeaders
    }, 
    function(data, response) {
      if (response.statusCode == 200) {
          onSuccess(_.map(JSON.parse(data), toUserSchema));
      } else {
        onError(new OktaClientError(data, response));
      }
    }).on('error',function(err) {
        console.log('something went wrong on the request', err.request.options);
        onError();
    });
  };
}

module.exports = OktaClient;
