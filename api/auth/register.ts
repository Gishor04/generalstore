import { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "general-store-super-secret-key-12345!";


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
            name,
            email,
            username,
            password,
            storeName,
            pin
        } = req.body;


        if (
            !name ||
            !email ||
            !username ||
            !password ||
            !storeName
        ) {

            return res.status(400).json({
                error: "All fields are required"
            });

        }


        const filePath = path.join(
            process.cwd(),
            "data/users.json"
        );


        let users: any[] = [];


        if (fs.existsSync(filePath)) {
            users = JSON.parse(
                fs.readFileSync(filePath, "utf8")
            );
        }



        const exists = users.find(
            u =>
                u.email === email ||
                u.username === username
        );


        if (exists) {

            return res.status(400).json({
                error: "User already exists"
            });

        }



        const hashedPassword =
            await bcrypt.hash(password, 10);


        const hashedPin =
            await bcrypt.hash(pin || "0814", 10);



        const newUser = {

            id: "usr_" + Date.now(),

            name,

            email,

            username,

            password: hashedPassword,

            pin: hashedPin,

            storeName,

            role: "owner"

        };



        users.push(newUser);



        fs.writeFileSync(
            filePath,
            JSON.stringify(users, null, 2)
        );




        const token = jwt.sign(

            {
                id: newUser.id,
                username,
                role: "owner",
                storeName

            },

            JWT_SECRET,

            {
                expiresIn: "30d"
            }

        );




        return res.status(201).json({

            message: "Registration successful",

            token,


            user: {
                id: newUser.id,
                name,
                email,
                username,
                storeName,
                role: "owner"
            }


        });



    }

    catch (error: any) {

        console.error(error);


        return res.status(500).json({

            error: error.message ||
                "Server error"

        });

    }

}