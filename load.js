// Root Domain:
const rootDomain = "pool.limo";

// RPC ID:
let rpcId = 1;

// On page load:
window.addEventListener("load", async () => {

  // Get message element:
  const message = document.getElementById("message");
  const log = (msg, type) => {
    switch(type) {
      case "error": {
        message.innerHTML = `error: ${msg}`;
        console.error(msg);
        break;
      }
      case "warning": {
        message.innerHTML = `warning: ${msg}`;
        console.warn(msg);
        break;
      }
      default: {
        message.innerHTML = msg;
        console.log(msg);
      }
    }
  };

  // Check page purpose:
  if (location.hostname.match(/^([0-9a-zA-Z]+)\.ipfs\.pool\.limo$/)) {
    log("resolving ipfs content...");

    // Register Service Worker:
    if ("serviceWorker" in navigator) {
      if ((location.pathname || "/") === "/") {

        // Register sw:
        try {
          await navigator.serviceWorker.register("sw.js");
          navigator.serviceWorker.ready.then(() => location.reload());
        } catch (err) {
          console.error(err);
        }
      } else {
        location.assign('/');
      }
    } else {
      log("failed to install service worker", "error");
    }
  } else {

    // Resolve name:
    const subdomain = location.hostname.slice(0, location.hostname.length - (rootDomain.length + 1));
    if(subdomain) {
      log("resolving name...");
      const res = await queryRPC(buildQuery("data", subdomain));
      if(Math.floor(res.status / 100) == 2) {
        if(res.body) {
          try {
            const json = await res.json();
            const byteLength = parseInt("0x" + json.result.slice(66, 130));
            if(byteLength == 0) {
              renderDefaultContent(subdomain);
            } else {
              const byteStr = json.result.slice(130, 130 + byteLength * 2);
              const bytes = new Uint8Array(byteLength);
              for(let i = 0; i < byteLength; i++) {
                bytes[i] = parseInt("0x" + byteStr.slice(i * 2, i * 2 + 2));
              }
              const decoder = new TextDecoder();
              const fieldsStr = decoder.decode(bytes.buffer);
              const fields = JSON.parse(fieldsStr);
              if(fields.content) {
                let [,,rootHash] = fields.content.match(/^(ipfs\:\/\/|\/ipfs\/)([a-zA-Z0-9]+)/);
                if(rootHash) {
                  const v1CID = Multiformats.CID.parse(rootHash).toV1().toString();
                  location.assign(`https://${v1CID}.ipfs.${rootDomain}`);
                } else {
                  log(`unsupported content field: ${fields.content}`, "error");
                  renderDefaultContent(subdomain);
                }
              } else {
                log("missing content field", "error");
                if(fields.url) {
                  log("redirecting to url...");
                  location.assign(fields.url);
                } else {
                  renderDefaultContent(subdomain);
                }
              }
            }
          } catch(err) {
            console.error(err);
            log("failed to parse results", "error");
          }
        } else {
          log("name not found", "error");
        }
      } else {
        console.error(res);
        log(`failed to resolve name (response status: ${res.status})`, "error");
      }
    } else {
      log("failed to parse name", "error");
    }
  }
});

// Function to build a contract query:
function buildQuery(method, name) {
  if(!["holder", "data"].includes(method)) throw new Error(`invalid method: ${method}`);
  const holderMethod = "bfcdd7c3";
  const dataMethod = "7afdfb4f";
  const nameBytes = (new TextEncoder()).encode(name);
  const mult32 = Math.ceil(nameBytes.length / 32);
  let nameHex = "";
  for(let i = 0; i < nameBytes.length; i++) {
    nameHex += nameBytes[i].toString(16).padStart(2, '0');
  }
  nameHex = nameHex.padEnd(mult32 * 32 * 2, '0');
  const nameLengthHex = nameBytes.length.toString(16).padStart(64, '0');
  return {
    jsonrpc: "2.0",
    id: rpcId++,
    method: "eth_call",
    params: [
      {
        data:`0x${method === "holder" ? holderMethod : dataMethod}0000000000000000000000000000000000000000000000000000000000000020${nameLengthHex}${nameHex}`,
        from:"0x0000000000000000000000000000000000000000",
        to:"0xf2c9e463592bd440f0d422e944e5f95c79404586"
      },
      "latest"
    ]
  }
}

// Function to query name info:
function queryRPC(request) {
  const rpcURL = `https://opt-mainnet.g.alchemy.com/v2/${"KEMBfW1C2O2rmTIP6gWVtUhltO-3XToo"}`;
  return fetch(rpcURL, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

// Default content:
async function renderDefaultContent(name) {
  location.assign(`https://names.pooly.me/#/domain/10/pool/${name}`);
}