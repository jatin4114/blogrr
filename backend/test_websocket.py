import asyncio
import websockets
import json
import sys
import time

async def test_connection():
    """Test WebSocket connection to the multiplexer"""
    uri = "ws://localhost:8000/ws/multiplex"
    
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Sending authentication immediately...")
            
            # Use command line argument as user_id if provided, otherwise use default
            user_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
            
            # Send authentication message
            auth_message = {"user_id": user_id}
            await websocket.send(json.dumps(auth_message))
            print(f"Authentication sent: {auth_message}")
            
            # Wait for authentication response
            response = await websocket.recv()
            print(f"Received: {response}")
            
            # Listen for messages
            print("Connection established. Waiting for messages...")
            try:
                while True:
                    message = await websocket.recv()
                    print(f"Received: {message}")
                    
                    # Parse the message to see if it's a heartbeat
                    try:
                        msg_data = json.loads(message)
                        if msg_data.get("type") == "heartbeat":
                            # Send a heartbeat acknowledgment
                            await websocket.send(json.dumps({"type": "heartbeat"}))
                            print("Sent heartbeat response")
                    except json.JSONDecodeError:
                        pass
            except asyncio.CancelledError:
                print("Connection closed by client")
                raise
            
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"Connection closed with code {e.code}: {e.reason}")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    try:
        asyncio.run(test_connection())
    except KeyboardInterrupt:
        print("Test stopped by user")
