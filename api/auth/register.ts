export default async function handler(req: any, res: any) {

    if (req.method !== "POST") {
        return res.status(405).json({
            message: "Method not allowed"
        });
    }

    const { name, email, password } = req.body;

    return res.status(200).json({
        message: "Register API working",
        user: {
            name,
            email
        }
    });
}