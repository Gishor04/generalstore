import { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";


const JWT_SECRET =
    process.env.JWT_SECRET ||
    "general-store-super-secret-key-12345!";


const filePath =
    path.join(
        "/tmp",
        "users.json"
    );



export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });

    }



    try {


        const {
            username,
            password
        } = req.body;



        if (!username || !password) {

            return res.status(400).json({
                error: "Username and password required"
            });

        }



        let users: any[] = [];



        if (fs.existsSync(filePath)) {

            users =
                JSON.parse(
                    fs.readFileSync(
                        filePath,
                        "utf8"
                    )
                );

        }



        const user =
            users.find(
                (u) =>
                    u.username === username
            );



        if (!user) {

            return res.status(401).json({
                error: "Invalid username or password"
            });

        }



        const valid =
            await bcrypt.compare(
                password,
                user.password
            );



        if (!valid) {

            return res.status(401).json({
                error: "Invalid username or password"
            });

        }



        const token =
            jwt.sign(

                {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    storeName: user.storeName
                },

                JWT_SECRET,

                {
                    expiresIn: "30d"
                }

            );



        return res.json({

            message: "Login successful",

            token,

            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                storeName: user.storeName,
                role: user.role
            }

        });


    }
    catch (error: any) {

        return res.status(500).json({
            error: error.message
        });

    }


}