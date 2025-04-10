import asyncio
import websockets
import json
import sys
import time
import argparse

async def send_message(websocket, message_data):
    """Send a message to the WebSocket server"""
    await websocket.send(json.dumps(message_data))
    print(f"Sent: {json.dumps(message_data, indent=2)}")

async def interactive_test(uri, user_id):
    """Interactive test for WebSocket multiplexer"""
    try:
        async with websockets.connect(uri) as websocket:
            print(f"Connected to {uri}")
            
            # First send authentication
            auth_message = {"user_id": user_id}
            await send_message(websocket, auth_message)
            
            # Set up message listener
            async def message_listener():
                while True:
                    try:
                        response = await websocket.recv()
                        print(f"\nReceived: {response}")
                    except websockets.exceptions.ConnectionClosed:
                        print("Connection closed by server")
                        return
            
            # Start listener in background
            listener_task = asyncio.create_task(message_listener())
            
            # Interactive command loop
            print("\nInteractive WebSocket Tester")
            print("Commands:")
            print("  dm <receiver_id> <message> - Send direct message")
            print("  presence <status>          - Update presence (online/away/busy/offline)")
            print("  typing <chat_id> <on/off>  - Send typing indicator")
            print("  quit                       - Exit the test")
            
            try:
                while True:
                    cmd = await asyncio.get_event_loop().run_in_executor(
                        None, lambda: input("\nEnter command: ")
                    )
                    
                    if cmd.lower() == "quit":
                        break
                        
                    parts = cmd.split(maxsplit=2)
                    
                    if parts[0] == "dm" and len(parts) >= 3:
                        receiver_id = int(parts[1])
                        message = parts[2]
                        await send_message(websocket, {
                            "type": "direct_message",
                            "content": {
                                "receiver_id": receiver_id,
                                "message": message,
                                "message_id": f"test-{int(time.time())}"
                            }
                        })
                    elif parts[0] == "presence" and len(parts) >= 2:
                        status = parts[1]
                        await send_message(websocket, {
                            "type": "presence",
                            "content": {
                                "status": status
                            }
                        })
                    elif parts[0] == "typing" and len(parts) >= 3:
                        chat_id = int(parts[1])
                        is_typing = parts[2].lower() == "on"
                        await send_message(websocket, {
                            "type": "typing",
                            "content": {
                                "chat_type": "direct",
                                "chat_id": chat_id,
                                "is_typing": is_typing
                            }
                        })
                    else:
                        print("Invalid command format")
            
            finally:
                listener_task.cancel()
                try:
                    await listener_task
                except asyncio.CancelledError:
                    pass
    
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"Connection closed with code {e.code}: {e.reason}")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Interactive WebSocket Tester")
    parser.add_argument("--user_id", type=int, default=1, help="User ID to authenticate with")
    parser.add_argument("--uri", default="ws://localhost:8000/ws/multiplex", help="WebSocket URI")
    
    args = parser.parse_args()
    
    try:
        asyncio.run(interactive_test(args.uri, args.user_id))
    except KeyboardInterrupt:
        print("\nTest stopped by user")
