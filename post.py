import requests;
import json;

url      = "http://rain.okta1.com:1802/api/v1/users?activate=false";
headers  = {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'Authorization': 'SSWS 004-egGf0SNHFOaeRvgClV5dsXF_zCz-_stRkTl4XB'
		   }
data = {
            "profile": {
		    "firstName": "Isaac",
		    "lastName": "Brock",
		    "email": "isaac@example.org",
		    "login": "isaac@example.org",
		    "mobilePhone": "555-415-1337"
		  }
	   }

data_dump = json.dumps(data)

res = requests.post(url=url,
                    data=data_dump,
                    headers=headers)

print res.text;