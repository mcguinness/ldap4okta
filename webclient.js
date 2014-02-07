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

function getUserByLogin (uid, baseUrl, authToken) {

  var userUID = uid; // TODO hackers: Parameterize this or extract it from LDAP query. 
                  // This would be the login attribute on the user.
  
  var authHeader = "SSWS " +  authToken; // TODO hackers: make this part of constructor

  oktaApi.registerMethod("getSingleActiveUser", baseUrl + "/api/v1/users/${uid}", "GET");
  var singleUserArgs = {
    path: {"uid": userUID },
    headers: {
      "Accept":"application/json",
      "Content-Type":"application/json",
      "Authorization": authHeader
     }
  }

  oktaApi.methods.getSingleActiveUser(singleUserArgs, 
    function(data, response) {
      if (response.statusCode == 200) {
          console.log("Getting list of Active Users: \n");
          //console.log(response);
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

exports.getActiveUsers = getActiveUsers;
exports.getUserByLogin = getUserByLogin;
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
