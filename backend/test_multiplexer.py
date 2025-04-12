import asyncio
import websockets
import json
import sys
import time
import argparse
from datetime import datetime

async def send_message(websocket, message_data):
    """Send a message to the WebSocket and print the response"""
    print(f"\n>>> Sending: {json.dumps(message_data, indent=2)}")
    await websocket.send(json.dumps(message_data))
    return await websocket.recv()

async def test_multiplexer():
    """Test various multiplexer functions"""
    parser = argparse.ArgumentParser(description="Test the multiplexer WebSocket")
    parser.add_argument("--user_id", type=int, default=1, help="User ID to authenticate with")
    parser.add_argument("--receiver_id", type=int, default=2, help="Receiver ID for direct message tests")
    parser.add_argument("--group_id", type=int, default=1, help="Group ID for group message tests")
    parser.add_argument("--uri", default="ws://localhost:8000/ws/multiplex", help="WebSocket URI")
    
    args = parser.parse_args()
    uri = args.uri
    user_id = args.user_id
    receiver_id = args.receiver_id
    group_id = args.group_id
    
    print(f"Testing multiplexer with: user_id={user_id}, receiver_id={receiver_id}, group_id={group_id}")
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Sending authentication immediately...")
            
            # Step 1: Authentication
            auth_message = {"user_id": user_id}
            response = await send_message(websocket, auth_message)
            print(f"<<< Authentication response: {response}")
            
            # Process initial messages (welcome, undelivered messages)
            print("\nProcessing initial server messages...")
            try:
                while True:
                    response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    print(f"<<< Received: {response}")
            except asyncio.TimeoutError:
                print("No more initial messages")
            
            # Interactive menu
            while True:
                print("\n===== Multiplexer Test Menu =====")
                print("1. Send direct message")
                print("2. Send group message")
                print("3. Update presence status")
                print("4. Send typing indicator")
                print("5. Subscribe to group")
                print("6. Unsubscribe from group")
                print("7. Sync direct messages")
                print("8. Sync group messages")
                print("9. Send custom JSON message")
                print("0. Exit")
                
                choice = input("\nEnter your choice (0-9): ")
                
                if choice == "0":
                    print("Exiting...")
                    break
                
                elif choice == "1":
                    # Direct message
                    receiver = input(f"Enter receiver ID [{receiver_id}]: ") or receiver_id
                    message = input("Enter message: ")
                    
                    dm_message = {
                        "type": "direct_message",
                        "content": {
                            "receiver_id": int(receiver),
                            "message": message,
                            "message_id": f"test-{int(time.time())}"
                        }
                    }
                    
                    response = await send_message(websocket, dm_message)
                    print(f"<<< Server response: {response}")
                
                elif choice == "2":
                    # Group message
                    group = input(f"Enter group ID [{group_id}]: ") or group_id
                    message = input("Enter message: ")
                    
                    group_message = {
                        "type": "group_message",
                        "content": {
                            "group_id": int(group),
                            "message": message,
                            "message_id": f"test-group-{int(time.time())}"
                        }
                    }
                    
                    response = await send_message(websocket, group_message)
                    print(f"<<< Server response: {response}")
                
                elif choice == "3":
                    # Presence update
                    print("Available statuses: online, away, busy, offline")
                    status = input("Enter status: ")
                    
                    presence_message = {
                        "type": "presence",
                        "content": {
                            "status": status
                        }
                    }
                    
                    response = await send_message(websocket, presence_message)
                    print(f"<<< Server response: {response}")
                
                elif choice == "4":
                    # Typing indicator
                    chat_type = input("Enter chat type (direct/group): ")
                    chat_id = input(f"Enter {'receiver' if chat_type == 'direct' else 'group'} ID: ")
                    is_typing = input("Is typing (true/false): ").lower() in ("true", "yes", "y", "1")
                    
                    typing_message = {
                        "type": "typing",
                        "content": {
                            "chat_type": chat_type,
                            "chat_id": chat_id,
                            "is_typing": is_typing
                        }
                    }
                    
                    response = await send_message(websocket, typing_message)
                    print(f"<<< Server response: {response}")
                
                elif choice == "5":
                    # Subscribe to group
                    group = input(f"Enter group ID to subscribe to [{group_id}]: ") or group_id
                    
                    subscribe_message = {
                        "type": "subscribe",
                        "content": {
                            "group_id": int(group)
                        }
                    }
                    
                    response = await send_message(websocket, subscribe_message)
                    print(f"<<< Server response: {response}")
                    
                    # Process group history messages
                    print("\nProcessing group history messages...")
                    try:
                        while True:
                            response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                            print(f"<<< Received history: {response}")
                    except asyncio.TimeoutError:
                        print("No more history messages")
                
                elif choice == "6":
                    # Unsubscribe from group
                    group = input(f"Enter group ID to unsubscribe from [{group_id}]: ") or group_id
                    
                    unsubscribe_message = {
                        "type": "unsubscribe",
                        "content": {
                            "group_id": int(group)
                        }
                    }
                    
                    response = await send_message(websocket, unsubscribe_message)
                    print(f"<<< Server response: {response}")
                
                elif choice == "7":
                    # Sync direct messages
                    contact_id = input(f"Enter contact ID to sync with [{receiver_id}]: ") or receiver_id
                    limit = input("Enter message limit [50]: ") or "50"
                    
                    sync_message = {
                        "type": "sync",
                        "content": {
                            "sync_type": "direct",
                            "contact_id": int(contact_id),
                            "limit": int(limit)
                        }
                    }
                    
                    response = await send_message(websocket, sync_message)
                    print(f"<<< Server response: {response}")
                    
                    # Process sync messages
                    print("\nProcessing sync messages...")
                    try:
                        while True:
                            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                            print(f"<<< Received sync: {response}")
                    except asyncio.TimeoutError:
                        print("Sync complete or timed out")
                
                elif choice == "8":
                    # Sync group messages
                    group = input(f"Enter group ID to sync [{group_id}]: ") or group_id
                    limit = input("Enter message limit [50]: ") or "50"
                    
                    sync_message = {
                        "type": "sync",
                        "content": {
                            "sync_type": "group",
                            "group_id": int(group),
                            "limit": int(limit)
                        }
                    }
                    
                    response = await send_message(websocket, sync_message)
                    print(f"<<< Server response: {response}")
                    
                    # Process sync messages
                    print("\nProcessing sync messages...")
                    try:
                        while True:
                            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                            print(f"<<< Received sync: {response}")
                    except asyncio.TimeoutError:
                        print("Sync complete or timed out")
                
                elif choice == "9":
                    # Custom JSON message
                    print("Enter custom JSON message (must be valid JSON):")
                    custom_json = input()
                    
                    try:
                        custom_message = json.loads(custom_json)
                        response = await send_message(websocket, custom_message)
                        print(f"<<< Server response: {response}")
                    except json.JSONDecodeError:
                        print("Invalid JSON format")
            
            # Set up background task to receive messages
            print("\nListening for incoming messages in the background...")
            while True:
                response = await websocket.recv()
                print(f"\n<<< Received: {response}")
                
                # Auto-respond to heartbeats
                try:
                    msg_data = json.loads(response)
                    if msg_data.get("type") == "heartbeat":
                        heartbeat_response = {"type": "heartbeat"}
                        await websocket.send(json.dumps(heartbeat_response))
                        print(">>> Sent heartbeat response")
                except json.JSONDecodeError:
                    pass
    
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"Connection closed with code {e.code}: {e.reason}")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    try:
        asyncio.run(test_multiplexer())
    except KeyboardInterrupt:
        print("\nTest stopped by user")
