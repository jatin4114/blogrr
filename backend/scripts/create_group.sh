#!/bin/bash

# Get the token from auth.json
TOKEN=$(grep -o '"token":"[^"]*' ../auth.json | cut -d'"' -f4)

# Make the API call
curl -X POST http://localhost:8000/chat/groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Group via cURL",
    "description": "Created using cURL command"
  }' | tee group_info.json

echo -e "\nGroup created successfully!"
