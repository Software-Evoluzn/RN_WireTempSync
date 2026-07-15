// src/utils/espDiscovery.js
// ESP32 ko local network par dhundhne (mDNS) aur confirm karne ke helpers.


import Zeroconf from 'react-native-zeroconf';

const HOSTNAME_MATCH = 'abc'; // firmware ke MDNS.begin("abc") se match

// ----------------------------------------------------------------
// mDNS se ESP32 ka IP nikaalo. Resolve hone tak ya timeout tak wait.
// ----------------------------------------------------------------
export function discoverEspIp({ timeoutMs = 18000 } = {}) {
    return new Promise((resolve, reject) => {
        const zc = new Zeroconf();
        let done = false;

        const finish = (ip, err) => {
            if (done) return;
            done = true;

            try {
                zc.stop();
                zc.removeAllListeners();
            } catch { }

            ip ? resolve(ip) : reject(err || new Error("ESP32 not found"));
        };

        zc.on("resolved", (service) => {
            console.log("Resolved:", service);

            const ip = service.addresses?.find(
                a => /^\d+\.\d+\.\d+\.\d+$/.test(a)
            );

            if (ip) {
                console.log("ESP IP:", ip);
                finish(ip);
            }
        });

        zc.on("error", e => {
            console.log("Zeroconf:", e);
        });

        setTimeout(() => {
            console.log("Scanning...");
            zc.scan("http", "tcp", "local");
        }, 300);

        setTimeout(() => {
            finish(null);
        }, timeoutMs);
    });
}


// export async function pingEsp(ip, timeoutMs = 2500) {
//     const ctrl = new AbortController();
//     const t = setTimeout(() => ctrl.abort(), timeoutMs);
//     try {
//         const res = await fetch(`http://${ip}/ping`, { signal: ctrl.signal });
//         clearTimeout(t);
//         if (!res.ok) return false;
//         const txt = (await res.text()).toLowerCase();
//         return txt.includes('esp') || txt.includes('evzn');
//     } catch (e) {
//         clearTimeout(t);
//         return false;
//     }
// }

// -
export async function resolveEspIp() {
  
    return await discoverEspIp();
}