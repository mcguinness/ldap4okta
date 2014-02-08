var ldap = require('ldapjs');
var OktaClient = require('./webclient.js');
var _ = require('underscore');



///--- Shared handlers

function authorize(req, res, next) {
  /* Any user may search after bind, only cn=root has full power */
  var isSearch = (req instanceof ldap.SearchRequest);
  // if (!req.connection.ldap.bindDN.equals('cn=root') && !isSearch)
  //   return next(new ldap.InsufficientAccessRightsError());

  return next();
}


///--- Globals

var SUFFIX = 'o=okta';
var USERSUFFIX = 'ou=users' + ',' + 'o=okta';
var GROUPSUFFIX = 'ou=groups' + ',' + 'o=okta';
var db = {};
var server = ldap.createServer();


if (process.argv[2] == "undefined") {
  console.log("API Token is required as an argument");
  console.log("server.js token");
  process.exit(0);
}

console.log(process.argv[2]);
var apiToken = process.argv[2];
var RestClient = require('node-rest-client').Client;
var orgBaseUrl = "http://rain.okta1.com:1802";
var oktaApi = new RestClient();
var authHeader = "SSWS " +  apiToken;
var directoryAdminDN = 'cn=root';
var oktaClient = new OktaClient(orgBaseUrl, authHeader);

// Magick DN for Service Account
server.bind(directoryAdminDN, function (req, res, next) {
  console.log("Directory Admin Bind");
  if (req.dn.toString() !== directoryAdminDN || req.credentials !== 'secret') {
    return next(new ldap.InvalidCredentialsError());
  }
  res.end();
  return next();
});

// User with DN
server.bind(SUFFIX, function (req, res, next) {
  console.log("Binding as: " + req.dn.toString() + " with password: " + req.credentials);

  console.log(req.dn.rdns[0].uid);

  if (req.dn.rdns[0].uid !== 'undefined') {
    oktaClient.authenticate(req.dn.rdns[0].uid, req.credentials, 
      function() {
          res.end();
          return next();
      }, function() {
         return next(new ldap.InvalidCredentialsError());
      });
  } else {
    console.log("InvalidCredentials: uid is not valid!")
    return next(new ldap.InvalidCredentialsError());
  }
});

// server.add(SUFFIX, authorize, function (req, res, next) {
//   var dn = req.dn.toString();

//   if (db[dn])
//     return next(new ldap.EntryAlreadyExistsError(dn));

//   db[dn] = req.toObject().attributes;
//   res.end();
//   return next();
// });

// server.bind(SUFFIX, function (req, res, next) {
//   var dn = req.dn.toString();
//   if (!db[dn])
//     return next(new ldap.NoSuchObjectError(dn));

//   if (!db[dn].userpassword)
//     return next(new ldap.NoSuchAttributeError('userPassword'));

//   if (db[dn].userpassword.indexOf(req.credentials) === -1)
//     return next(new ldap.InvalidCredentialsError());

//   res.end();
//   return next();
// });

// server.compare(SUFFIX, authorize, function (req, res, next) {
//   var dn = req.dn.toString();
//   if (!db[dn])
//     return next(new ldap.NoSuchObjectError(dn));

//   if (!db[dn][req.attribute])
//     return next(new ldap.NoSuchAttributeError(req.attribute));

//   var matches = false;
//   var vals = db[dn][req.attribute];
//   for (var i = 0; i < vals.length; i++) {
//     if (vals[i] === req.value) {
//       matches = true;
//       break;
//     }
//   }

//   res.end(matches);
//   return next();
// });

// server.del(SUFFIX, authorize, function (req, res, next) {
//   var dn = req.dn.toString();
//   if (!db[dn])
//     return next(new ldap.NoSuchObjectError(dn));

//   delete db[dn];

//   res.end();
//   return next();
// });

// server.modify(SUFFIX, authorize, function (req, res, next) {
//   var dn = req.dn.toString();
//   if (!req.changes.length)
//     return next(new ldap.ProtocolError('changes required'));
//   if (!db[dn])
//     return next(new ldap.NoSuchObjectError(dn));

//   var entry = db[dn];

//   for (var i = 0; i < req.changes.length; i++) {
//     mod = req.changes[i].modification;
//     switch (req.changes[i].operation) {
//     case 'replace':
//       if (!entry[mod.type])
//         return next(new ldap.NoSuchAttributeError(mod.type));

//       if (!mod.vals || !mod.vals.length) {
//         delete entry[mod.type];
//       } else {
//         entry[mod.type] = mod.vals;
//       }

//       break;

//     case 'add':
//       if (!entry[mod.type]) {
//         entry[mod.type] = mod.vals;
//       } else {
//         mod.vals.forEach(function (v) {
//           if (entry[mod.type].indexOf(v) === -1)
//             entry[mod.type].push(v);
//         });
//       }

//       break;

//     case 'delete':
//       if (!entry[mod.type])
//         return next(new ldap.NoSuchAttributeError(mod.type));

//       delete entry[mod.type];

//       break;
//     }
//   }

//   res.end();
//   return next();
// });

server.search(USERSUFFIX, function(req, res, next) {
    console.log('base object: ' + req.dn.toString());
    console.log('scope: ' + req.scope);
    console.log('filter: ' + req.filter.toString());

    switch(req.filter.type.toLowerCase()) {
      case 'equal': {
        if(req.filter.attribute == 'uid') {
          oktaClient.getUserByUid(req.filter.value, 
            function(userAttributes) {
              res.send({
                dn: "uid=" + userAttributes.uid + "," + USERSUFFIX,
                attributes: userAttributes
              });
              res.end();
            }, function() {
              res.end()
            });
        } else {
          console.log('unknown filter');
        }
        break;
      }
      case 'and':{
        //assume objectclass=group as first filter
        var uid = req.filter.filters[1].value;
        console.log(uid);
        oktaClient.getUserGroups(uid, 
          function(ldapGroups) {
            _.each(ldapGroups, function(ldapGroup) {
              res.send({ 
                dn: "gid=" + ldapGroup.gid + "," + GROUPSUFFIX,
                attributes: ldapGroup 
              });
            });
          res.end();
          }, function() {
          res.end()
        });
        break;
      }
      default: {
        oktaClient.getUsers( 
          function(ldapUsers) {
            _.each(ldapUsers, function(user) {
              res.send({ 
                dn: "uid=" + user.uid + "," + USERSUFFIX,
                attributes: user 
              });
            });
            res.end();
          }, function() {
          res.end()
        });
      }
    }
});

server.search(GROUPSUFFIX, function(req, res, next) {
    console.log('base object: ' + req.dn.toString());
    console.log('scope: ' + req.scope);
    console.log('filter: ' + req.filter.toString());

    switch(req.filter.type.toLowerCase()) {
      case 'equal': {
        oktaClient.getGroupById(req.filter.value, 
          function(ldapGroup) {
            res.send({
              dn: "gid=" + ldapGroup.gid + "," + GROUPSUFFIX,
              attributes: ldapGroup
            });
            res.end();
          }, function() {
            res.end()
          });
        break;
      }
      case 'and':{
        //assume objectclass=user as firsr filter
        var groupName = req.filter.filters[1].value;
        console.log(groupName);
        oktaClient.getGroupUsers(groupName, 
          function(ldapUsers) {
            _.each(ldapUsers, function(user) {
            res.send({ 
              dn: "uid=" + user.uid + "," + USERSUFFIX,
              attributes: user 
            });
          });
            res.end();
          }, function() {
            res.end()
          });
        break;
      }
      default: {
        oktaClient.getGroups( 
          function(ldapGroups) {
            _.each(ldapGroups, function(ldapGroup) {
              res.send({ 
                dn: "gid=" + ldapGroup.gid + "," + GROUPSUFFIX,
                attributes: ldapGroup 
              });
            });
          res.end();
          }, function() {
          res.end()
        });
      }
    }
});

server.search("cn=foo", authorize, function (req, res, next) {
  var dn = req.dn.toString();
  if (!db[dn])
    return next(new ldap.NoSuchObjectError(dn));

  var scopeCheck;

  switch (req.scope) {
  case 'base':
    if (req.filter.matches(db[dn])) {
      res.send({
        dn: dn,
        attributes: db[dn]
      });
    }

    res.end();
    return next();

  case 'one':
    scopeCheck = function (k) {
      if (req.dn.equals(k))
        return true;

      var parent = ldap.parseDN(k).parent();
      return (parent ? parent.equals(req.dn) : false);
    };
    break;

  case 'sub':
    scopeCheck = function (k) {
      return (req.dn.equals(k) || req.dn.parentOf(k));
    };

    break;
  }

  Object.keys(db).forEach(function (key) {
    if (!scopeCheck(key))
      return;

    if (req.filter.matches(db[key])) {
      res.send({
        dn: key,
        attributes: db[key]
      });
    }
  });

  res.end();
  return next();
});



///--- Fire it up

server.listen(1389, function () {
  console.log('LDAP server up at: %s', server.url);
});