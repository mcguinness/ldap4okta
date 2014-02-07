var RestClient = require('node-rest-client').Client;
var oktaApi = new RestClient();



function getActiveUsers (baseUrl, authToken) {

   oktaApi.registerMethod("getActiveUsers", baseUrl + "/api/v1/users", "GET");
   var authHeader = "SSWS " +  authToken;
   var allUsersArgs = {
      headers: {
        "Accept":"application/json",
        "Content-Type":"application/json",
        "Authorization": authHeader
      }
    }
    oktaApi.methods.getActiveUsers(allUsersArgs, 
      function(data, response) {
        if (response.statusCode == 200) {
            console.log("Getting list of Active Users: \n");
            console.log(response);
            console.log(data);
            transformToLdapRecords(JSON.parse(data));
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

function getUserByLogin (uid, baseUrl, authToken, callback) {
  

  oktaApi.registerMethod("getSingleActiveUser", baseUrl + "/api/v1/users/${uid}", "GET");
  var singleUserArgs = {
    path: {"uid": uid },
    headers: {
      "Accept":"application/json",
      "Content-Type":"application/json",
      "Authorization": "SSWS " +  authToken
     }
  }

  console.log(singleUserArgs);

  oktaApi.methods.getSingleActiveUser(singleUserArgs, 
    function(data, response) {
      if (response.statusCode == 200) {
          console.log("Response Data:");
          console.log(data);
          console.log();
          callback(userToAttributes(JSON.parse(data)));
      } else {
        console.log("Wrong API Token!");
        //return next(new ldap.InvalidCredentialsError());
      }
    }).on('error',function(err) {
        console.log('something went wrong on the request', err.request.options);
        //return next(new ldap.InvalidCredentialsError());
    });
}

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

function transformToLdapRecords(data) {
    var users = [];
    console.log("num users: " + data.length);
    for (var i=0; i<data.length; i++) {
        console.log(data[i]);
        users[i] = {
            objectClass: ['inetorgperson', 'organizationalperson', 'person', 'top'],
            sn: data[i]['profile']['lastName'],
            givenName: data[i]['profile']['firstName'],
            mail: data[i]['profile']['email'],
            mobile: data[i]['profile']['mobilePhone'],
            uid: data[i]['profile']['login']
        };
    }
    console.log(users);
}

exports.getActiveUsers  = getActiveUsers;
exports.getUserByLogin  = getUserByLogin;
exports.getGroupsById   = getGroupsById;
exports.getGroupsByName = getGroupsByName;
exports.getAllGroups    = getAllGroups;
/*var api = function (authHeader) {


  var oktaApi = new RestClient();
  oktaApi.registerMethod("getActiveUsers", orgBaseUrl + "/api/v1/users", "GET");

   this.getActiveUsers = function() {
   var allUsersArgs = {
      headers: {
        "Accept":"application/json",
        "Content-Type":"application/json",
        "Authorization": authHeader
      }
    }
    oktaApi.methods.getActiveUsers(allUsersArgs, 
      function(data, response) {
        if (response.statusCode == 200) {
            console.log("Getting list of Active Users: \n");
            console.log(response);
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


}*/
