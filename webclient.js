var RestClient = require('node-rest-client').Client;




function userToAttributes(user) {
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

function groupToAttributes(group) {
  return {
      objectClass: ['okta-group', 'group', 'top'],
      name: group.profile.name,
      description: group.profile.description,
      gid: group.id
  };
}



// Constructor
function OktaClient(baseUrl, apiToken) {
  
  var oktaApi = new RestClient();
  var httpHeaders = {
    "Accept":"application/json",
    "Content-Type":"application/json",
    "Authorization": apiToken
  };

  // Add Methods
  oktaApi.registerMethod("createSession", baseUrl + "/api/v1/sessions", "POST");
  oktaApi.registerMethod("getUser", baseUrl + "/api/v1/users/${uid}", "GET");
  oktaApi.registerMethod("getUsers", baseUrl + "/api/v1/users", "GET");
  oktaApi.registerMethod("findUsers", baseUrl + "/api/v1/users", "GET");
  oktaApi.registerMethod("getGroups", baseUrl + "/api/v1/groups", "GET");
  oktaApi.registerMethod("getGroup", baseUrl + "/api/v1/groups/${gid}", "GET");

  this.authenticate = function(userName, password, onSuccess, onFail) {
    oktaApi.methods.createSession({
        headers: httpHeaders,
        data: {
          "username": userName,
          "password": password
        }
      }, function(data, response) {
        if (response.statusCode == 200) {
          console.log("User is authenticated!");
          onSuccess();
        } else if (response.statusCode == 401) {
          console.log("Invalid Credentials for user " + userName);
          onFail();
        } else {
          onFail();
        }
      }).on('error',function(err) {
          onFail();
      });
  }

  this.getUserByUid = function (uid, onSuccess, onFail) {
    oktaApi.methods.getUser({
        path: {"uid": uid },
        headers: httpHeaders
      },
      function(data, response) {
        if (response.statusCode == 200) {
            console.log("Response Data:");
            console.log(data);
            console.log();
            onSuccess(userToAttributes(JSON.parse(data)));
        } else {
          console.log("Wrong API Token!");
          onFail();
        }
      }).on('error',function(err) {
          console.log('something went wrong on the request', err.request.options);
          onFail();
      });
  }

  this.getUsers = function(onSuccess, onFail) {
    console.log("Getting active users: ");
    oktaApi.methods.getUsers( { headers: httpHeaders }, 
      function(data, response) {
        if (response.statusCode == 200) {
            //console.log(data);
            var users = JSON.parse(data);
            var ldapUsers = [];
            for (var i=0; i<users.length; i++) {
              ldapUsers[i] = userToAttributes(users[i]);
            }
            return onSuccess(ldapUsers);
        } else {
          console.log("Wrong API Token!");
          onFail();
        }
      }).on('error',function(err) {
          console.log('something went wrong on the request', err.request.options);
          onFail();
    });

  };


  this.findUsers = function(query, onSuccess, onFail) {
    console.log("Finding user that match: " + query);

    var args = { 
        parameters: {
          q: query
        },
        headers: httpHeaders
      };

      console.log(args);
    oktaApi.methods.findUsers(args, 
      function(data, response) {
        if (response.statusCode == 200) {
            console.log(data);
            var users = JSON.parse(data);
            var ldapUsers = [];
            for (var i=0; i<users.length; i++) {
              ldapUsers[i] = userToAttributes(users[i]);
            }
            return onSuccess(ldapUsers);
        } else {
          console.log("Wrong API Token!");
          onFail();
        }
      }).on('error',function(err) {
          console.log('something went wrong on the request', err.request.options);
          onFail();
    });

  };

  this.getGroups = function (onSuccess, onFail) {
    console.log("Getting active users: ");
    oktaApi.methods.getGroups({ headers: httpHeaders },
      function(data, response) {
        if (response.statusCode == 200) {
            console.log(data);
            var groups = JSON.parse(data);
            var ldapGroups = [];
            for (var i=0; i<groups.length; i++) {
              ldapGroups[i] = groupToAttributes(groups[i]);
            }
            return onSuccess(ldapGroups);
        } else {
          console.log("Wrong API Token!");
        }
      }).on('error',function(err) {
          console.log('something went wrong on the request', err.request.options);
    });
  };


  this.getGroupById = function(groupId, onSuccess, onFail) {
    console.log("Getting group:  " + groupId);
    oktaApi.methods.getGroup({
      path: { "gid": groupId },
      headers: httpHeaders
    }, 
    function(data, response) {
      if (response.statusCode == 200) {
          console.log(data);
          onSuccess(groupToAttributes(JSON.parse(data)));
      } else {
        onFail();
      }
    }).on('error',function(err) {
        console.log('something went wrong on the request', err.request.options);
        onFail();
    });
  };
}



module.exports = OktaClient;
