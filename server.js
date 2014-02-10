var ldap          = require('ldapjs'),
    fs            = require('fs'),
    _             = require('underscore'),
    url           = require('url'),
    deferred      = require('deferred'),
    TreeModel     = require('tree-model'),
    RestClient    = require('node-rest-client').Client;
    OktaClient    = require('./webclient.js'),
    FilterHandler = require('./filterHandler.js');



var argv = require('yargs')
    .usage('Okta LDAP Proxy v0.1\nUsage: $0')
    .example('$0 -f', 'count the lines in the given file')
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
var ADMIN_DN = 'cn=root';
var ADMIN_PWD = 'secret';
var ORG_SUBDOMAIN = url.parse(argv.url).host.match(/^(?![0-9]+$)(?!.*-$)(?!-)[a-zA-Z0-9-]{1,63}/)[0];

///--- Globals
var dit = new TreeModel().parse({
  dn: 'o=' + ORG_SUBDOMAIN,
  attributes: {
    objectClass: [ 'top', 'organization' ],
    o: ORG_SUBDOMAIN,
    name: ORG_SUBDOMAIN
  },
  children: [
    {
      dn: 'ou=users,o=' + ORG_SUBDOMAIN,
      attributes: {
        objectClass: [ 'top', 'organizationalUnit' ],
        ou: 'users',
        name: 'users'
      }
    },
    {
      dn: 'ou=groups,o=' + ORG_SUBDOMAIN,
      attributes: {
        objectClass: [ 'top', 'organizationalUnit' ],
        ou: 'groups',
        name: 'groups'
      }
    }
  ]
});

_.extend(dit, {
  parentDNs: function () {
    var parents = [];
    this.walk(function(node) {
      if (_.isString(node.model.dn)) {
        parents.push(node.model.dn);
      }
    });
    return parents;
  },
  usersDN: function() {
    var dn;
    this.walk(function(node) {
      if (node.model.attributes.ou == 'users') {
        dn = node.model.dn;
        return false;
      }
      return true;
    });
    return dn;
  },
  groupsDN: function() {
    var dn;
    this.walk(function(node) {
      if (node.model.attributes.ou == 'groups') {
        dn = node.model.dn;
        return false;
      }
      return true;
    });
    return dn;
  },
  schemaMapper: {
    toUser: function(user) {
      return {
        dn: "uid=" + user.profile.login + "," + dit.usersDN(),
        attributes: {
          objectClass: ['okta-user', 'inetorgperson', 'organizationalperson', 'person', 'top'],
          cn: user.profile.login,
          userName: user.profile.login,
          sn: user.profile.lastName,
          givenName: user.profile.firstName,
          mail: user.profile.email,
          mobile: user.profile.mobilePhone,
          uid: user.profile.login,
          title: user.profile.title,
          manager: user.profile.manager,
          physicalDeliveryOfficeName: user.profile.location,
          uid: user.id
        }
      }
    },
    toGroup: function(group) {
      return {
        dn: 'gid=' + group.id + ',' + dit.groupsDN(),
        attributes: {
          objectClass: ['okta-group', 'group', 'top'],
          name: group.profile.name,
          description: group.profile.description,
          gid: group.id
        }
      }
    }
  }
});





var options = argv.tls ? {
  certificate: fs.readFileSync('server-cert.pem', encoding='ascii'),
  key: fs.readFileSync('server-key.pem', encoding='ascii')
} : {};
var server = ldap.createServer(options);
var oktaClient = new OktaClient(argv.url, "SSWS " +  argv.token, dit.schemaMapper);


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
server.bind(dit.model.dn, function (req, res, next) {
  logRequest(req);
  if (req.dn.rdns[0].uid !== 'undefined') {
    oktaClient.authenticate(req.dn.rdns[0].uid, req.credentials, 
      function(err) {
        if (err) {
          logResult(req, 'InvalidCredentialsError - [credentials not valid]');
          return next(new ldap.InvalidCredentialsError());
        } else {
          logResult(req, 'Success');
          res.end();
          return next();
        }
      });
  } else {
    logResult(req, 'InvalidCredentialsError - [uid not present]');
    return next(new ldap.InvalidCredentialsError());
  }
});

// server.add(ROOT_DN, authorize, function (req, res, next) {
//   var dn = req.dn.toString();

//   if (dit[dn])
//     return next(new ldap.EntryAlreadyExistsError(dn));

//   dit[dn] = req.toObject().attributes;
//   res.end();
//   return next();
// });

// server.compare(ROOT_DN, authorize, function (req, res, next) {
//   var dn = req.dn.toString();
//   if (!dit[dn])
//     return next(new ldap.NoSuchObjectError(dn));

//   if (!dit[dn][req.attribute])
//     return next(new ldap.NoSuchAttributeError(req.attribute));

//   var matches = false;
//   var vals = dit[dn][req.attribute];
//   for (var i = 0; i < vals.length; i++) {
//     if (vals[i] === req.value) {
//       matches = true;
//       break;
//     }
//   }

//   res.end(matches);
//   return next();
// });

// server.del(ROOT_DN, authorize, function (req, res, next) {
//   var dn = req.dn.toString();
//   if (!dit[dn])
//     return next(new ldap.NoSuchObjectError(dn));

//   delete dit[dn];

//   res.end();
//   return next();
// });

// server.modify(ROOT_DN, authorize, function (req, res, next) {
//   var dn = req.dn.toString();
//   if (!req.changes.length)
//     return next(new ldap.ProtocolError('changes required'));
//   if (!dit[dn])
//     return next(new ldap.NoSuchObjectError(dn));

//   var entry = dit[dn];

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


server.search('cn=nomas', function(req, res, next) {
    console.log('base object: ' + req.dn.toString());
    console.log('scope: ' + req.scope);
    console.log('filter: ' + req.filter.toString());

    switch(req.filter.type.toLowerCase()) {
      case 'equal': {
        oktaClient.getGroupById(req.filter.value, 
          function(ldapGroup) {
            res.send({
              dn: "gid=" + ldapGroup.gid + "," + GROUPS_DN,
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
              dn: "uid=" + user.uid + "," + USERS_DN,
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
                dn: "gid=" + ldapGroup.gid + "," + GROUPS_DN,
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

server.search(dit.model.dn, authorize, function (req, res, next) {
  logRequest(req);
  
  if (!_.some(dit.parentDNs(), function(dn) {
    return req.dn.equals(dn) || req.dn.childOf(dn);
  })) {
    return next(new ldap.NoSuchObjectError(req.dn.toString()));
  }

  var handler = new FilterHandler();
  handler.execute(req.filter, oktaClient, function(err, results) {
    if (err) {
      console.log(err);
      return next(new ldap.UnwillingToPerformError(req.dn.toString()));
    } else {
      _.each(_.flatten(results), function(result) {
        res.send(result);
      });
      res.end();
      return next();
    }
  });
});



///--- Fire it up

server.listen(argv.port, function () {
  console.log('LDAP server up at: %s', server.url);
});
