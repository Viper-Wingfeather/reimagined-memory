const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

let server;

test.before(async () => {
  if (fs.existsSync("data.json")) {
    fs.unlinkSync("data.json");
  }

  server = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: "3100" },
  });

  await new Promise((resolve) => setTimeout(resolve, 700));
});

test.after(() => {
  server.kill();
});

test("admin login and signup flow works", async () => {
  const loginResponse = await fetch("http://127.0.0.1:3100/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "school-admin" }),
  });
  assert.equal(loginResponse.status, 200);
  const loginData = await loginResponse.json();
  assert.ok(loginData.token);

  const signupResponse = await fetch("http://127.0.0.1:3100/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Avery", itemType: "Lunch", notes: "Pasta" }),
  });
  assert.equal(signupResponse.status, 201);

  const duplicateResponse = await fetch("http://127.0.0.1:3100/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Jamie", itemType: "Lunch", notes: "Salad" }),
  });
  assert.equal(duplicateResponse.status, 409);

  const selfRemoveResponse = await fetch("http://127.0.0.1:3100/api/signup/self", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Avery" }),
  });
  assert.equal(selfRemoveResponse.status, 200);

  const eventResponse = await fetch("http://127.0.0.1:3100/api/event", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": loginData.token,
    },
    body: JSON.stringify({ date: "2026-08-01", location: "Gym Hall" }),
  });
  assert.equal(eventResponse.status, 200);
  const eventData = await eventResponse.json();
  assert.equal(eventData.location, "Gym Hall");

  const partialUpdateResponse = await fetch("http://127.0.0.1:3100/api/event", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": loginData.token,
    },
    body: JSON.stringify({ location: "Library Hall" }),
  });
  assert.equal(partialUpdateResponse.status, 200);
  const partialUpdateData = await partialUpdateResponse.json();
  assert.equal(partialUpdateData.date, "2026-08-01");
  assert.equal(partialUpdateData.location, "Library Hall");
});
