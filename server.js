const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "school-admin";

let adminToken = null;

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      event: {
        title: "School Group Signup",
        date: "",
        location: "",
      },
      signups: [],
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

function readData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, content, contentType = "text/plain") {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(content);
}

function serveStaticFile(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypeMap = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  };

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }

    sendText(res, 200, content, contentTypeMap[extension] || "application/octet-stream");
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function isAdminAuthenticated(req) {
  return req.headers["x-admin-token"] === adminToken;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/") {
    serveStaticFile(res, path.join(__dirname, "index.html"));
    return;
  }

  if (req.method === "GET" && (url.pathname === "/index.html" || url.pathname === "/styles.css" || url.pathname === "/app.js")) {
    serveStaticFile(res, path.join(__dirname, url.pathname.slice(1)));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/data") {
    const data = readData();
    sendJson(res, 200, data);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/signups") {
    const data = readData();
    sendJson(res, 200, data.signups);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/event") {
    const data = readData();
    sendJson(res, 200, data.event);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    try {
      const body = await parseBody(req);
      if (body.password === ADMIN_PASSWORD) {
        adminToken = `admin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sendJson(res, 200, { token: adminToken });
      } else {
        sendJson(res, 401, { error: "Invalid admin password" });
      }
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    adminToken = null;
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/signup/self") {
    try {
      const body = await parseBody(req);
      if (!body.name) {
        sendJson(res, 400, { error: "Name is required." });
        return;
      }

      const data = readData();
      const originalLength = data.signups.length;
      data.signups = data.signups.filter((signup) => signup.name !== body.name.trim());

      if (data.signups.length === originalLength) {
        sendJson(res, 404, { error: "No matching signup found." });
        return;
      }

      writeData(data);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/signup") {
    try {
      const body = await parseBody(req);
      if (!body.name || !body.itemType) {
        sendJson(res, 400, { error: "Name and item type are required." });
        return;
      }

      const data = readData();
      const itemType = body.itemType.trim();
      const existingSignup = data.signups.find((signup) => signup.itemType === itemType);

      if (existingSignup) {
        sendJson(res, 409, { error: `${itemType} is already claimed.` });
        return;
      }

      const signup = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: body.name.trim(),
        itemType,
        notes: body.notes ? body.notes.trim() : "",
        createdAt: new Date().toISOString(),
      };

      data.signups = [signup, ...data.signups];
      writeData(data);
      sendJson(res, 201, signup);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/event") {
    if (!isAdminAuthenticated(req)) {
      sendJson(res, 401, { error: "Admin access required." });
      return;
    }

    try {
      const body = await parseBody(req);
      const data = readData();
      const nextDate = body.date !== undefined ? body.date : data.event.date;
      const nextLocation = body.location !== undefined ? body.location : data.event.location;
      data.event = {
        ...data.event,
        title: body.title || data.event.title,
        date: nextDate,
        location: nextLocation,
      };
      writeData(data);
      sendJson(res, 200, data.event);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/signup/")) {
    if (!isAdminAuthenticated(req)) {
      sendJson(res, 401, { error: "Admin access required." });
      return;
    }

    const signupId = url.pathname.split("/").pop();
    const data = readData();
    const originalLength = data.signups.length;
    data.signups = data.signups.filter((signup) => signup.id !== signupId);

    if (data.signups.length === originalLength) {
      sendJson(res, 404, { error: "Signup not found." });
      return;
    }

    writeData(data);
    sendJson(res, 200, { success: true });
    return;
  }

  sendText(res, 404, "Not found");
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
