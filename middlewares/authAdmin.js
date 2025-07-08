import jwt from 'jsonwebtoken';

const authAdmin = async (req, res, next) => { 
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'No authentication token, authorization denied.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.email !== process.env.ADMIN_EMAIL) {
            return res.status(401).json({ success: false, message: "Not authorized. Invalid admin email." });
        }
        req.admin = decoded;
        next(); 
        
    } catch (err) {
        console.error("Auth middleware error:", err);

        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Your session has expired. Please log in again.' });
        } else if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: 'Invalid token, please log in again.' });
        } else {
            return res.status(500).json({ success: false, message: 'An unexpected authentication error occurred.' });
        }
    }
}

export default authAdmin;