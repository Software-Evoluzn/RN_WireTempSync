from datetime import datetime, timedelta

from WTYSync_Backend.WTYSync_Backend.models.RegisterProduct import RegisterProduct
from database.db import db


socketio_instance = None


def init_socket(socketio):
    global socketio_instance
    socketio_instance = socketio



def check_device_status():

    timeout = datetime.utcnow() - timedelta(seconds=30)


    devices = RegisterProduct.query.all()


    for device in devices:


        if device.last_seen:


            if device.last_seen < timeout:


                if device.online_status == True:


                    device.online_status = False


                    print(
                        "DEVICE OFFLINE:",
                        device.serial_no
                    )


                    if socketio_instance:

                        socketio_instance.emit(
                            "device_status",
                            {
                                "serial_no": device.serial_no,
                                "online": False
                            }
                        )


    db.session.commit()