import fs from "fs";
import path from "path";
import crypto from "crypto";

export default function handler(req: any, res: any) {

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { name, email, username, password, storeName, pin } = req.body;

    const filePath = path.join(process.cwd(), "data/users.json");

    const users = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const exists = users.find((u: any) => u.email === email);

    if (exists) {
        return res.status(400).json({
            error: "User already exists"
        });
    }

    const user = {
        id: Date.now(),
        name,
        email,
        username,
        password,
        storeName,
        pin,
        role: "owner"
    };

    users.push(user);

    fs.writeFileSync(
        filePath,
        JSON.stringify(users, null, 2)
    );

    const token = crypto.randomBytes(32).toString("hex");

    return res.status(200).json({
        token,
        user
    });
}