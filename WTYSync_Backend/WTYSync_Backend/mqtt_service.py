import json
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import paho.mqtt.client as mqtt

from database.db import db
from models.RegisterProduct import RegisterProduct
from routes.telemetry import process_and_save_mqtt_data

broker = "evoluzn.org"
port = 18889
username = "evzin_led"
password = "63I9YhMaXpa49Eb"

client = mqtt.Client()
client.username_pw_set(username, password)

flask_app = None
socketio_instance = None
scheduler = None


def check_inactive_devices():
    """Periodically checks for devices that haven't sent data recently
    and marks them offline (online_status = 0).
    """
    print("⏰ [Scheduler] Running check for inactive devices...")
    if not flask_app:
        print("⚠️ [Scheduler] flask_app is None, skipping check.")
        return

    with flask_app.app_context():
        try:
            # ✅ STRICT LOCAL TIME MATCHING DATABASE TIMESTAMPS
            timeout_threshold = datetime.now() - timedelta(minutes=3)

            # Query active devices (1) that haven't updated last_seen in > 3 minutes
            updated_count = (
                db.session.query(RegisterProduct)
                .filter(
                    RegisterProduct.online_status == 1,
                    RegisterProduct.last_seen < timeout_threshold,
                )
                .update({"online_status": 0}, synchronize_session=False)
            )

            db.session.commit()

            if updated_count > 0:
                print(
                    f"✅ [Scheduler] Marked {updated_count} inactive device(s) as offline (online_status = 0)."
                )
            else:
                print("ℹ️ [Scheduler] All active devices are up to date.")

        except Exception as e:
            db.session.rollback()
            print("❌ [Scheduler] Error updating offline status:", str(e))


def init_app(app, socketio_ref=None):
    global flask_app, socketio_instance, scheduler
    flask_app = app
    socketio_instance = socketio_ref

    if socketio_instance is None:
        print(
            "⚠️ WARNING: socketio_instance not set! Live telemetry emit will not work."
        )

    # Initialize and start background scheduler to check for offline devices every 60 seconds
    if scheduler is None:
        scheduler = BackgroundScheduler()
        scheduler.add_job(
            func=check_inactive_devices, trigger="interval", seconds=60
        )
        scheduler.start()
        print("✅ Background offline status checker started successfully.")


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
    raw_payload = msg.payload.decode("utf-8")

    print(f"Data --> {topic} | Payload: {raw_payload}")

    if not flask_app:
        print("⚠️ flask_app not set, skipping message")
        return

    with flask_app.app_context():
        # ✅ HANDLE EXPLICIT LWT OFFLINE PAYLOADS (e.g., {WTSF0C045:offline})
        if "offline" in raw_payload.lower():
            try:
                product = RegisterProduct.query.filter_by(serial_no=serial).first()
                if product:
                    product.online_status = 0
                    db.session.commit()
                    print(f"🔴 Device {serial} explicitly sent offline status.")
            except Exception as e:
                db.session.rollback()
                print(f"❌ Error setting offline status for {serial}:", str(e))
            return

        # 1. Process telemetry and save to DB
        process_and_save_mqtt_data(serial, raw_payload)

        # 2. Live Socket.IO Emit
        try:
            if socketio_instance is None:
                print(
                    "⚠️ socketio_instance is None, cannot emit live telemetry"
                )
                return

            if "device_id" in raw_payload:
                clean_string = raw_payload.strip("{} ")
                parts = clean_string.split(":")

                if len(parts) > 2:
                    float_values = []
                    for val in parts[2:]:
                        try:
                            float_values.append(float(val.strip()))
                        except ValueError:
                            pass

                    if len(float_values) > 0:
                        column_order = [
                            "R1", "Y1", "B1", "N1",
                            "R2", "Y2", "B2", "N2",
                            "R3", "Y3", "B3", "N3",
                            "R4", "Y4", "B4", "N4",
                            "R5", "Y5", "B5", "N5",
                            "R6", "Y6", "B6", "N6",
                        ]

                        panels_dict = {}
                        for index, val in enumerate(float_values):
                            if index < len(column_order):
                                col = column_order[index]
                                panel_no = int(col[1])

                                if panel_no not in panels_dict:
                                    panels_dict[panel_no] = []

                                panels_dict[panel_no].append(
                                    {
                                        "phase": col,
                                        "current": val,
                                        "min": val,
                                        "max": val,
                                    }
                                )

                        formatted_panels = [
                            {"panel_no": p_no, "temperatures": temps}
                            for p_no, temps in panels_dict.items()
                        ]

                        telemetry_payload = {
                            "serial_no": serial,
                            "status": "Online",
                            "panels": formatted_panels,
                        }

                        socketio_instance.emit(
                            "live_telemetry", telemetry_payload
                        )
                        print(
                            "Successfully emitted live telemetry for:", serial
                        )

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