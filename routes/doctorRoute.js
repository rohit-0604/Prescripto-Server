// backend/routes/doctorRouter.js
import express from 'express';
// Import all controller functions, including the new one
import { doctorList, loginDoctor, getDoctorProfile, updateDoctorProfile, changeAvailability, getDoctorAppointments, markAppointmentAsCompleted } from '../controllers/doctorController.js';
import authDoctor from '../middlewares/authDoctor.js'; // Ensure authDoctor middleware is imported

const doctorRouter = express.Router();

// Public routes
doctorRouter.get('/list', doctorList);
doctorRouter.post('/login', loginDoctor);

// Protected routes (require a valid doctor token)
doctorRouter.get('/profile', authDoctor, getDoctorProfile);
doctorRouter.put('/profile/update', authDoctor, updateDoctorProfile);
doctorRouter.put('/profile/availability', authDoctor, changeAvailability);
doctorRouter.get('/appointments', authDoctor, getDoctorAppointments);
doctorRouter.put('/appointments/mark-completed', authDoctor, markAppointmentAsCompleted); // <--- ADD THIS NEW ROUTE

export default doctorRouter;