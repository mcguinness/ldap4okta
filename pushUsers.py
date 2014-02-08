import json
import requests
import re

a = re.compile(".*[0-9].*");

url      = "http://rain.okta1.com:1802/api/v1/users?activate=false";
headers  = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'SSWS 004-egGf0SNHFOaeRvgClV5dsXF_zCz-_stRkTl4XB'
           }

with open('./users.json') as data_file:    
    totalUsers = json.load(data_file)

    for users in totalUsers:
        fullName = users["name"];
        nameList = fullName.split(" ");
        if nameList.count > 0:
            givenName = nameList[0];
            lastName  = nameList[-1];
        else:
            givenName, lastName = fullName, fullName;
        print "GivenName " + givenName + " lastName " + lastName;

        login  = users["name"].replace(" ", "") + "@okta.com"
        mail   = login;
        uid    = login;
        mobile = users["cell_phone"];
        json_data = "";
        if a.match(mobile):
            print "valid"
            json_data = {
                "profile": {
                    "firstName": givenName,
                    "lastName" : lastName,
            
                    "email": login,
                    "login": login,
                    "mobilePhone": mobile
                  }
                  };
        else:
            print "invalid";
            json_data = {
                "profile": {
                    "firstName": givenName,
                    "lastName" : lastName,
            
                    "email": login,
                    "login": login,
                  }
                  };

        print givenName, login, mail, uid, mobile
        data_dump = json.dumps(json_data);
        res = requests.post(url=url,
                    data=data_dump,
                    headers=headers)
        print res.text;
        
        print "\n";


#print data