import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth'
import IP_ADDRESS from '../services/ipconfig'

const BASE_URL = `http://${IP_ADDRESS}:5006`;

export const registerProduct = async (product) => {

    console.log("Base URL:", BASE_URL);
    console.log("Request URL:", `${BASE_URL}/register-product`);
    console.log("Request Body:", JSON.stringify(product, null, 2));

    try {

        const response = await fetch(
            `${BASE_URL}/register-product`,
            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify(product)

            }
        );

        console.log("Status Code:", response.status);
        console.log("Response OK:", response.ok);

        const result = await response.json();

        console.log("Response Data:", result);
        console.log("==========================================");

        return result;


    } catch (error) {
        console.log("API Error:", error);
        throw error;
    }




};

export const getProducts = async () => {
    try {
        const firebase_uid = auth().currentUser?.uid

        console.log("======================================");
        console.log("Fetching Registered Products");
        console.log("Firebase UID:", firebase_uid);

        const url = `${BASE_URL}/get-products`;

        console.log("Request URL:", url);
        console.log("Request URL:", url);

        const requestBody = {
            firebase_uid,
        };

        console.log("Request Body : ", requestBody);

        const response = await fetch(`${BASE_URL}/get-products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        console.log("Status Code:", response.status);
        console.log("Response OK:", response.ok);

        const result = await response.json();

        console.log("Products Response:", result);
        return result;

    } catch (error) {
      
      
        console.log(error);
        console.log("Message:", error.message);
 


        return {
            success: false,
            message: error.message,
        }

    }
}