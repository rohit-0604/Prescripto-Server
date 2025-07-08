// backend/controllers/doctorController.js
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js"; // Ensure this is imported
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';

// NEW: API to mark an appointment as completed
const markAppointmentAsCompleted = async (req, res) => {
    try {
        const doctorId = req.doctorId; // Doctor ID from authentication token
        const { appointmentId } = req.body; // Appointment ID to mark as completed

        if (!doctorId) {
            return res.status(400).json({ success: false, message: 'Doctor ID is missing from token.' });
        }
        if (!appointmentId) {
            return res.status(400).json({ success: false, message: 'Appointment ID is required.' });
        }

        // Find the appointment and ensure it belongs to the logged-in doctor
        const appointment = await appointmentModel.findOne({ _id: appointmentId, docId: doctorId });

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found or does not belong to you.' });
        }

        // Prevent marking already completed or cancelled appointments
        if (appointment.isCompleted) {
            return res.status(400).json({ success: false, message: 'Appointment is already marked as completed.' });
        }
        if (appointment.cancelled) {
            return res.status(400).json({ success: false, message: 'Cannot mark a cancelled appointment as completed.' });
        }
        // If payment status is pending, consider changing it to paid upon completion
        // or ensure your system handles payment status updates separately.
        // For simplicity, we'll mark paymentStatus as 'paid' if not already.
        const update = { isCompleted: true };
        if (appointment.paymentStatus === 'pending') {
            update.paymentStatus = 'paid';
        }

        const updatedAppointment = await appointmentModel.findByIdAndUpdate(
            appointmentId,
            { $set: update },
            { new: true } // Returns the updated document
        );

        res.status(200).json({ success: true, message: 'Appointment marked as completed!', appointment: updatedAppointment });

    } catch (error) {
        console.error("Error marking appointment as completed:", error);
        res.status(500).json({ success: false, message: 'An error occurred while marking the appointment as completed.' });
    }
};

// Existing: API to get a doctor's appointments
const getDoctorAppointments = async (req, res) => {
    try {
        const doctorId = req.doctorId; // From authDoctor middleware

        if (!doctorId) {
            return res.status(400).json({ success: false, message: 'Doctor ID is missing from token.' });
        }

        // Find appointments for this doctor, sorted chronologically by slot date and time
        const appointments = await appointmentModel.find({ docId: doctorId })
                                                   .sort({ slotDate: 1, slotTime: 1, createdAt: 1 }); // Sort by ascending slotDate, then slotTime, then createdAt

        res.status(200).json({ success: true, appointments });

    } catch (error) {
        console.error("Error fetching doctor appointments:", error);
        res.status(500).json({ success: false, message: 'An error occurred while fetching appointments.' });
    }
};


// --- Keep your existing functions below this line (updateDoctorProfile, getDoctorProfile, changeAvailability, doctorList, loginDoctor) ---

const updateDoctorProfile = async (req, res) => {
    try {
        const doctorId = req.doctorId;
        const { name, fees, address, about, experience } = req.body;
        const updateFields = {};
        if (name !== undefined) updateFields.name = name;
        if (fees !== undefined) updateFields.fees = fees;
        if (address !== undefined) updateFields.address = address;
        if (about !== undefined) updateFields.about = about;
        if (experience !== undefined) updateFields.experience = experience;
        const updatedDoctor = await doctorModel.findByIdAndUpdate(
            doctorId,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).select('-password');
        if (!updatedDoctor) {
            return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
        }
        res.status(200).json({ success: true, message: 'Profile updated successfully!', doctor: updatedDoctor });
    } catch (error) {
        console.error("Error updating doctor profile:", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'An error occurred while updating the doctor profile.' });
    }
}

const getDoctorProfile = async (req, res) => {
    try {
        const doctor = await doctorModel.findById(req.doctorId).select('-password');
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
        }
        res.status(200).json({ success: true, doctor });

    } catch (error) {
        console.error("Error fetching doctor profile:", error);
        res.status(500).json({ success: false, message: 'An error occurred while fetching the doctor profile.' });
    }
}

const changeAvailability = async (req,res) => {
    try {
        const targetDoctorId = req.doctorId;
        if (!targetDoctorId) {
             return res.status(400).json({ success: false, message: 'Doctor ID is missing from token.' });
        }
        const docdata = await doctorModel.findById(targetDoctorId);
        if (!docdata) {
            return res.status(404).json({ success: false, message: 'Doctor not found.' });
        }
        await doctorModel.findByIdAndUpdate(targetDoctorId, {available: !docdata.available });
        res.json({success:true, message:'Availability Changed'});
    } catch (error) {
        console.error("Error changing availability:", error);
        res.status(500).json({success:false,message:error.message});
    }
}

const doctorList = async (req,res)=> {
    try {
        const doctors = await doctorModel.find({}).select(['-email','-password']);
        res.json({success:true,doctors});
    } catch (error) {
        console.error("Error fetching doctor list:", error);
        res.status(500).json({success:false,message:error.message});
    }
}

const loginDoctor = async (req,res) => {
    try {
        const { email, password } = req.body;
        const doctor = await doctorModel.findOne({email});
        if(!doctor){
            return res.json({success:false,message:'Invalid Credentials'});
        }
        const isMatch = await bcrypt.compare(password,doctor.password);
        if(isMatch){
            const token = jwt.sign({id:doctor._id},process.env.JWT_SECRET);
            res.json({success:true,token});
        } else {
            res.json({success:false,message:'Invalid Credentials'});
        }
    } catch (error) {
        console.error("Error during doctor login:", error);
        res.status(500).json({success:false,message:error.message});
    }
}

export {
    changeAvailability,
    doctorList,
    loginDoctor,
    getDoctorProfile,
    updateDoctorProfile,
    getDoctorAppointments,
    markAppointmentAsCompleted // <--- EXPORT THE NEW FUNCTION
};