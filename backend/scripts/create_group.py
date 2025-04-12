import requests
import json
import os

# Load token from auth.json
with open('../auth.json', 'r') as f:
    auth_data = json.load(f)
    token = auth_data.get('token')

# API endpoint
url = "http://localhost:8000/chat/groups"

# Group data
group_data = {
    "name": "Test Group Chat",
    "description": "This is a test group for messaging"
}

# Make the request
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

response = requests.post(url, json=group_data, headers=headers)

# Print the response
print(f"Status code: {response.status_code}")
print("Response:")
print(json.dumps(response.json(), indent=2))

# Save the group info to a file for later use
if response.status_code == 201:
    with open('group_info.json', 'w') as f:
        json.dump(response.json(), f, indent=2)
    print(f"Group created successfully. ID: {response.json()['id']}")
else:
    print("Failed to create group.")
