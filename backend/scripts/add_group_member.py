import requests
import json
import sys

def add_member_to_group(group_id, user_id, role="member"):
    """Add a user to a group chat"""
    
    # Load token from auth.json
    with open('../auth.json', 'r') as f:
        auth_data = json.load(f)
        token = auth_data.get('token')
    
    # API endpoint
    url = f"http://localhost:8000/chat/groups/{group_id}/members"
    
    # Member data
    member_data = {
        "user_id": user_id,
        "role": role
    }
    
    # Make the request
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(url, json=member_data, headers=headers)
    
    # Print the response
    print(f"Status code: {response.status_code}")
    print("Response:")
    print(json.dumps(response.json(), indent=2))
    
    if response.status_code == 201:
        print(f"✅ Successfully added user {user_id} to group {group_id} with role '{role}'")
    else:
        print(f"❌ Failed to add user to group: {response.json().get('detail', 'Unknown error')}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python add_group_member.py <group_id> <user_id> [role]")
        sys.exit(1)
        
    group_id = int(sys.argv[1])
    user_id = int(sys.argv[2])
    role = sys.argv[3] if len(sys.argv) > 3 else "member"
    
    add_member_to_group(group_id, user_id, role)
