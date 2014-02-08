var ldap       = require('ldapjs');
    fs         = require('fs'),
    _          = require('underscore'),
    RestClient = require('node-rest-client').Client;
    OktaClient = require('./webclient.js');



var argv = require('yargs')
    .usage('Okta LDAP Proxy v0.1\nUsage: $0')
    .default({ p: 1389, url: 'http://rain.okta1.com:1802', tls: false })
    .alias('t', 'token')
    .describe('token', 'SSWS API Token')
    .alias('p', 'port')
    .describe('port', 'LDAP listener port')
    .describe('url', 'Okta organization url')
    .describe('tls', 'Enable ssl/tls listener')
    .demand('t')
    .argv
;

///--- Shared handlers

function authorize(req, res, next) {
  /* Any user may search after bind, only cn=root has full power */
  var isSearch = (req instanceof ldap.SearchRequest);
  // if (!req.connection.ldap.bindDN.equals('cn=root') && !isSearch)
  //   return next(new ldap.InsufficientAccessRightsError());

  return next();
}


///--- Constants

var SUFFIX = 'o=okta';
var USERSUFFIX = 'ou=users' + ',' + 'o=okta';
var GROUPSUFFIX = 'ou=groups' + ',' + 'o=okta';
var ADMIN_DN = 'cn=root';
var ADMIN_PWD = 'secret';

///--- Globals

var db = {};
var options = argv.tls ? {
  certificate: fs.readFileSync('server-cert.pem', encoding='ascii'),
  key: fs.readFileSync('server-key.pem', encoding='ascii')
} : {};
var server = ldap.createServer(options);
var oktaApi = new RestClient();
var oktaClient = new OktaClient(argv.url, "SSWS " +  argv.token);


function logRequest(req) {
  console.log(req.type + ' (' + req.id + ') ' + ' [DN: ' + req.dn.toString() + ']');
  
  if (req instanceof ldap.SearchRequest) {
    console.log('\tBase DN: ' + req.dn.toString());
    console.log('\tScope: ' + req.scope);
    console.log('\tFilter: ' + req.filter.toString() + ' Type: ' + req.filter.type);
  }
}

function logResult(req, status) {
  console.log(req.type + ' (' + req.id + ') ' + ' [DN: ' + req.dn.toString() + '] => Result: ' + status);
}

// Magick DN for Service Account
server.bind(ADMIN_DN, function (req, res, next) {
  logRequest(req);
  if (req.dn.toString() !== ADMIN_DN || req.credentials !== ADMIN_PWD) {
    logResult(req, 'InvalidCredentialsError');
    return next(new ldap.InvalidCredentialsError());
  }
  logResult(req, 'Success');
  res.end();
  return next();
});

// User with DN
server.bind(SUFFIX, function (req, res, next) {
  logRequest(req);
  if (req.dn.rdns[0].uid !== 'undefined') {
    oktaClient.authenticate(req.dn.rdns[0].uid, req.credentials, 
      function() {
        logResult(req, 'Success');
        res.end();
        return next();
      },
      function() {
        logResult(req, 'InvalidCredentialsError - [credentials not valid]');
        return next(new ldap.InvalidCredentialsError());
      });
  } else {
    logResult(req, 'InvalidCredentialsError - [uid not present]');
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
  logRequest(req);

    // filter: (&(|(givenname=karl*)(sn=karl*)(mail=karl*)(cn=karl*)))
    if (req.filter.type === 'and' && req.filter.filters[0].type === 'or') {
      var orFilters = req.filter.filters[0].filters;
      if (_.find(orFilters, function(filter) {
        return (filter.type == 'substring' && 
          (filter.attribute == 'givenName' || filter.attribute == 'sn' || filter.attribute == 'email'));
      })) {
        oktaClient.findUsers(orFilters[0].initial,
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
      } else {
        res.end();
      }
    } else if(req.filter.attribute == 'uid') {
      
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
});

server.search(GROUPSUFFIX, function(req, res, next) {
    console.log('base object: ' + req.dn.toString());
    console.log('scope: ' + req.scope);
    console.log('filter: ' + req.filter.toString());

    var f = ldap.parseFilter('(&' + req.filter.toString() + ')');
    console.log(f);
    if(f.filters[0].attribute == 'cn') {
      oktaClient.getGroupById(f.filters[0].value, 
        function(ldapGroup) {
          res.send({
            dn: "gid=" + ldapGroup.gid + "," + GROUPSUFFIX,
            attributes: ldapGroup
          });
          res.end();
        }, function() {
          res.end()
        });
    } else {
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

server.listen(argv.port, function () {
  console.log('LDAP server up at: %s', server.url);
});