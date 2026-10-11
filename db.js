// Storage for accounts, sessions and orders.
//
//  - Default: one JSON file in DATA_DIR (good for running on your own computer).
//  - If FIREBASE_SERVICE_ACCOUNT is set: Google Firestore, so data survives restarts and redeploys
//    on free hosts that wipe local files.
//
// server.js keeps everything in memory and calls save(store) after each change.
// The Firestore backend works out which records changed and writes only those.

const fs = require("fs");
const path = require("path");

const COLLECTIONS = ["users", "sessions", "adminSessions", "orders"];
const emptyStore = () => ({ users: [], sessions: [], adminSessions: [], orders: [] });

function docId(collection, item) {
  return collection === "sessions" || collection === "adminSessions" ? item.token : item.id;
}

function fileBackend(dataDir) {
  const storePath = path.join(dataDir, "store.json");
  return {
    name: `file (${storePath})`,
    async load() {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(storePath)) {
          fs.writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2));
          return emptyStore();
        }
        return { ...emptyStore(), ...JSON.parse(fs.readFileSync(storePath, "utf8")) };
      } catch (err) {
        console.error("Could not load store, starting empty.", err.message);
        return emptyStore();
      }
    },
    save(store) {
      fs.mkdirSync(dataDir, { recursive: true });
      const tmp = storePath + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
      fs.renameSync(tmp, storePath);
    },
    async flush() {},
  };
}

function parseServiceAccount(raw) {
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const json = JSON.parse(text);
  if (json.private_key) json.private_key = json.private_key.replace(/\\n/g, "\n");
  return json;
}

function firestoreBackend(rawServiceAccount) {
  const admin = require("firebase-admin");
  const account = parseServiceAccount(rawServiceAccount);
  admin.initializeApp({ credential: admin.credential.cert(account) });
  const db = admin.firestore();

  let synced = {}; // collection -> id -> JSON string of what Firestore currently holds
  let queue = Promise.resolve();

  async function writeOps(ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = db.batch();
      for (const op of ops.slice(i, i + 400)) {
        const ref = db.collection(op.collection).doc(op.id);
        if (op.type === "set") batch.set(ref, JSON.parse(op.json));
        else batch.delete(ref);
      }
      await batch.commit();
    }
  }

  return {
    name: `Firestore (project ${account.project_id})`,
    async load() {
      const store = emptyStore();
      synced = {};
      for (const collection of COLLECTIONS) {
        synced[collection] = {};
        const snap = await db.collection(collection).get();
        snap.forEach((doc) => {
          const data = doc.data();
          store[collection].push(data);
          synced[collection][doc.id] = JSON.stringify(data);
        });
      }
      store.users.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      store.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest first
      return store;
    },
    save(store) {
      // Work out what changed right now, then write it in the background, in order.
      const ops = [];
      for (const collection of COLLECTIONS) {
        const before = synced[collection] || (synced[collection] = {});
        const seen = new Set();
        for (const item of store[collection]) {
          const id = docId(collection, item);
          const json = JSON.stringify(item); // drops undefined, which Firestore rejects
          seen.add(id);
          if (before[id] !== json) {
            ops.push({ type: "set", collection, id, json });
            before[id] = json;
          }
        }
        for (const id of Object.keys(before)) {
          if (!seen.has(id)) {
            ops.push({ type: "delete", collection, id });
            delete before[id];
          }
        }
      }
      if (!ops.length) return;
      queue = queue.then(async () => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            return await writeOps(ops);
          } catch (err) {
            console.error(`Firestore write failed (attempt ${attempt}/3):`, err.message);
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
        console.error("Firestore write gave up. These changes were not saved:", ops.length);
      });
    },
    flush() {
      return queue;
    },
  };
}

function createBackend({ dataDir, firebaseServiceAccount }) {
  return firebaseServiceAccount ? firestoreBackend(firebaseServiceAccount) : fileBackend(dataDir);
}

module.exports = { createBackend, emptyStore };
