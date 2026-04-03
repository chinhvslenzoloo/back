import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

async function test() {
  const token = jwt.sign(
    { userId: "ddb5a06a-0c1b-48e9-b2de-492f-a332-a1ebc7829d7f", tenantId: "6e6c95e1-cade-492f-a332-a1ebc7829d7f" },
    process.env.JWT_SECRET
  );

  try {
    const res = await fetch("https://backend-j3u1.onrender.com/products?inStock=true", {
      headers: { "Authorization": "Bearer " + token }
    });
    console.log("Status:", res.status);
    const data = await res.text();
    console.log("Data:", data);
  } catch (err) {
    console.error("Fetch failed", err);
  }
}
test();
