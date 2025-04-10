import asyncio
import websockets
import json
import sys
import time
from datetime import datetime

async def monitor_multiplexer():
    """
    Simple monitoring client that connects and displays all incoming messages
    """
    user_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    uri = "ws://localhost:8000/ws/multiplex"
    
    print(f"Monitoring multiplexer as user {user_id} at {uri}")
    print(f"Connecting at {datetime.now().strftime('%H:%M:%S')}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Sending authentication...")
            
            # Send authentication
            auth_message = {"user_id": user_id}
            await websocket.send(json.dumps(auth_message))
            print(f"Authentication sent: {auth_message}")
            
            # Main monitoring loop
            print("\n=== MONITORING STARTED ===")
            while True:
                message = await websocket.recv()
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"\n[{timestamp}] RECEIVED:")
                
                try:
                    # Pretty print JSON
                    data = json.loads(message)
                    print(json.dumps(data, indent=2))
                    
                    # Auto-respond to heartbeats
                    if data.get("type") == "heartbeat":
                        await websocket.send(json.dumps({"type": "heartbeat"}))
                        print(f"[{timestamp}] Auto-responded to heartbeat")
                except:
                    # If not valid JSON, print as is
                    print(message)
    
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"Connection closed with code {e.code}: {e.reason}")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    try:
        asyncio.run(monitor_multiplexer())
    except KeyboardInterrupt:
        print("\nMonitoring stopped by user")
