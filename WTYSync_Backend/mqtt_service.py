import json
import paho.mqtt.client as mqtt

from datetime import datetime

from database.db import db
from models.RegisterProuct import RegisterProduct

broker = "evoluzn.org"
port = 18889
username = "evzin_led"
password = "63I9YhMaXpa49Eb"

client = mqtt.Client()

# Set username and password
client.username_pw_set(username, password)


    
flask_app = None
def init_app(app):
    global flask_app
    flask_app = app


def on_connect(client, userdata, flags, rc):
    print("=================================")
    print("Connected to MQTT Broker")
    print("Result Code:", rc)

    if rc == 0:
        print("Connection Successful")

        client.subscribe("#")
        # client.subscribe("WTS+/status")
        print("Subscribed to #")

    else:
        print("Connection Failed")


def on_message(client, userdata, msg):
    
    topic = msg.topic
    
    #Ignore non-WTS devices
    if not topic.startswith("WTS"):
        return
    
    # print("\n============== MQTT MESSAGE ==============")
    # print("Topic:", msg.topic)
    # print("Payload:", msg.payload.decode())
    # print("==========================================")
    
    serial = msg.topic.split("/")[0]
    print("Searching Serial:", serial)
    
    with flask_app.app_context():
       
        product = RegisterProduct.query.filter_by(
            serial_no=serial
        ).first()
        if product:

            product.online_status = True
            product.last_seen = datetime.utcnow()

            db.session.commit()
        
        

        


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
