var RestClient = require('node-rest-client').Client;




function userToAttributes(user) {
  return {
      objectClass: ['inetorgperson', 'organizationalperson', 'person', 'top'],
      sn: user['profile']['lastName'],
      givenName: user['profile']['firstName'],
      mail: user['profile']['email'],
      mobile: user['profile']['mobilePhone'],
      uid: user['profile']['login']
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
  oktaApi.registerMethod("getSingleActiveUser", baseUrl + "/api/v1/users/${uid}", "GET");
  oktaApi.registerMethod("getActiveUsers", baseUrl + "/api/v1/users", "GET");

  this.getUserByUid = function (uid, onSuccess, onFail) {
    oktaApi.methods.getSingleActiveUser({
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
    oktaApi.methods.getActiveUsers( { headers: httpHeaders }, 
      function(data, response) {
        if (response.statusCode == 200) {
            console.log("Getting list of Active Users: \n");
            console.log(response);
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

  }
}



function getGroupsById (groupId, baseUrl, authToken) {

  var authHeader = "SSWS " +  authToken; // TODO hackers: make this part of constructor

   oktaApi.registerMethod("getGroupsById", baseUrl + "/api/v1/groups/${gid}", "GET");
   var authHeader = "SSWS " +  authToken;
   var allUsersArgs = {
      path: {"gid": groupId },
      headers: {
        "Accept":"application/json",
        "Content-Type":"application/json",
        "Authorization": authHeader
      }
    }
    oktaApi.methods.getGroupsById(allUsersArgs, 
      function(data, response) {
        if (response.statusCode == 200) {
            console.log("Getting list of Groups with Id " + groupId + "\n");
            console.log(data);
            //return next();
        } else {
          console.log("Wrong API Token!");
          //return next(new ldap.InvalidCredentialsError());
        }
      }).on('error',function(err) {
          console.log('something went wrong on the request', err.request.options);
          //return next(new ldap.InvalidCredentialsError());
    });
}

function getGroupsByName (groupPrefix, baseUrl, authToken) {
   oktaApi.registerMethod("getGroupsByName", baseUrl + "/api/v1/groups", "GET");
   var authHeader = "SSWS " +  authToken;
   var allUsersArgs = {
      parameters:{q:groupPrefix},
      headers: {
        "Accept":"application/json",
        "Content-Type":"application/json",
        "Authorization": authHeader
      }
    }
    oktaApi.methods.getGroupsByName(allUsersArgs, 
      function(data, response) {
        if (response.statusCode == 200) {
            console.log("Getting list of Groups with Prefix " + groupPrefix + "\n");
            console.log(data);
            //return next();
        } else {
          console.log("Wrong API Token!");
          //return next(new ldap.InvalidCredentialsError());
        }
      }).on('error',function(err) {
          console.log('something went wrong on the request', err.request.options);
          //return next(new ldap.InvalidCredentialsError());
    });
}

function getAllGroups (baseUrl, authToken) {
   oktaApi.registerMethod("getGroupsByName", baseUrl + "/api/v1/groups", "GET");
   var authHeader = "SSWS " +  authToken;
   var allUsersArgs = {
      parameters:{limit:'200'},
      headers: {
        "Accept":"application/json",
        "Content-Type":"application/json",
        "Authorization": authHeader
      }
    }
    oktaApi.methods.getGroupsByName(allUsersArgs, 
      function(data, response) {
        if (response.statusCode == 200) {
            console.log("Getting list of Groups ");
            console.log(data);
            //return next();
        } else {
          console.log("Wrong API Token!");
          //return next(new ldap.InvalidCredentialsError());
        }
      }).on('error',function(err) {
          console.log('something went wrong on the request', err.request.options);
          //return next(new ldap.InvalidCredentialsError());
    });
}


module.exports = OktaClient;
