import { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { MongoClient } from "mongodb";


const JWT_SECRET =
    process.env.JWT_SECRET ||
    "general-store-super-secret-key-12345!";


const MONGODB_URI =
    process.env.MONGODB_URI!;


let client: MongoClient;



async function connectDB() {

    if (!client) {
        if (!MONGODB_URI) {
            throw new Error("MONGODB_URI is not defined");
        }
        client = new MongoClient(MONGODB_URI);
        await client.connect();
    }

    return client.db("general-store");

}



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



        const db = await connectDB();



        const users =
            db.collection("users");



        const exists =
            await users.findOne({

                $or: [
                    { email },
                    { username }
                ]

            });



        if (exists) {

            return res.status(400).json({
                error: "User already exists"
            });

        }



        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );



        const hashedPin =
            await bcrypt.hash(
                pin || "0814",
                10
            );



        const newUser = {


            name,

            email,

            username,


            password:
                hashedPassword,


            pin:
                hashedPin,


            storeName,


            role: "owner",


            createdAt:
                new Date()

        };



        const result =
            await users.insertOne(newUser);



        const token =
            jwt.sign(

                {
                    id: result.insertedId,
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

            message:
                "Registration successful",


            token,


            user: {
                id: result.insertedId,
                name,
                email,
                username,
                storeName,
                role: "owner"
            }

        });



    }
    catch (error: any) {


        console.error(
            "REGISTER ERROR",
            error
        );


        return res.status(500).json({

            error: error.message

        });


    }

}