import json
import paho.mqtt.client as mqtt

from routes.telemetry import process_and_save_mqtt_data

broker = "evoluzn.org"
port = 18889
username = "evzin_led"
password = "63I9YhMaXpa49Eb"

client = mqtt.Client()
client.username_pw_set(username, password)

flask_app = None
socketio_instance = None


def init_app(app, socketio_ref=None):
    global flask_app, socketio_instance
    flask_app = app
    socketio_instance = socketio_ref
    if socketio_instance is None:
        print("⚠️ WARNING: socketio_instance not set! Live telemetry emit will not work.")


def on_connect(client, userdata, flags, rc):
    print("=================================")
    print("Connected to MQTT Broker")
    print("Result Code:", rc)

    if rc == 0:
        print("Connection Successful")
        client.subscribe("#")
        print("Subscribed to #")
    else:
        print("Connection Failed")


def on_message(client, userdata, msg):
    topic = msg.topic

    # Ignore non-WTS devices
    if not topic.startswith("WTS"):
        return

    serial = topic.split("/")[0]
    raw_payload = msg.payload.decode('utf-8')

    print(f"Data --> {topic} | Payload: {raw_payload}")

    if not flask_app:
        print("⚠️ flask_app not set, skipping message")
        return

    with flask_app.app_context():
        process_and_save_mqtt_data(serial, raw_payload)

        # -------------------------------------------------------------
        # LIVE SOCKET.IO EMIT: Push telemetry to frontend in real time
        # -------------------------------------------------------------
        try:
            if socketio_instance is None:
                print("⚠️ socketio_instance is None, cannot emit live telemetry")
                return

            if "device_id" in raw_payload:
                clean_string = raw_payload.strip("{} ")
                parts = clean_string.split(":")

                if len(parts) > 2:
                    float_values = []
                    for val in parts[2:]:
                        try:
                            float_values.append(float(val))
                        except ValueError:
                            pass

                    if len(float_values) > 0:
                        column_order = [
                            'R1', 'Y1', 'B1', 'N1', 'R2', 'Y2', 'B2', 'N2',
                            'R3', 'Y3', 'B3', 'N3', 'R4', 'Y4', 'B4', 'N4',
                            'R5', 'Y5', 'B5', 'N5', 'R6', 'Y6', 'B6', 'N6'
                        ]

                        panels_dict = {}
                        for index, val in enumerate(float_values):
                            if index < len(column_order):
                                col = column_order[index]
                                panel_no = int(col[1])

                                if panel_no not in panels_dict:
                                    panels_dict[panel_no] = []

                                panels_dict[panel_no].append({
                                    "phase": col,
                                    "current": val,
                                    "min": val,
                                    "max": val
                                })

                        formatted_panels = [
                            {
                                "panel_no": p_no,
                                "temperatures": temps
                            } for p_no, temps in panels_dict.items()
                        ]

                        telemetry_payload = {
                            "serial_no": serial,
                            "status": "Online",
                            "panels": formatted_panels
                        }

                        socketio_instance.emit("live_telemetry", telemetry_payload)
                        print("Successfully emitted live telemetry for:", serial)

        except Exception as e:
            print("Error emitting live socket telemetry from MQTT:", str(e))


def on_disconnect(client, userdata, rc):
    print("Disconnected from Broker:", rc)


client.on_connect = on_connect
client.on_message = on_message
client.on_disconnect = on_disconnect


def start_mqtt():
    print("Connecting to MQTT Broker...")
    client.connect(broker, port, 60)
    client.loop_start()


def publish(topic, message):
    client.publish(topic, json.dumps(message))