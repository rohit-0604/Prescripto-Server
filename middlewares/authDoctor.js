import jwt from 'jsonwebtoken';
import doctorModel from '../models/doctorModel.js'; // Import the doctor model to verify doctor existence

const authDoctor = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'No authentication token, authorization denied.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const doctor = await doctorModel.findById(decoded.id);
        if (!doctor) {
            return res.status(401).json({ success: false, message: "Not authorized. Doctor not found or invalid token payload." });
        }

        req.doctorId = decoded.id;
        next();
    } catch (err) {
        console.error("Doctor Auth middleware error:", err);

        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Your doctor session has expired. Please log in again.' });
        } else if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: 'Invalid token, please log in again.' });
        } else {
            return res.status(500).json({ success: false, message: 'An unexpected authentication error occurred.' });
        }
    }
}

export default authDoctor;
