import validator from 'validator';
import bcrypt from 'bcrypt';
import userModel from '../models/userModel.js';
import doctorModel from '../models/doctorModel.js';
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from 'cloudinary';
import appointmentModel from '../models/appointmentModel.js';
import crypto from 'crypto'; // Import crypto for hashing

// Ensure you have these in your .env file
// PAYU_MERCHANT_KEY=YOUR_PAYU_MERCHANT_KEY
// PAYU_SALT=YOUR_PAYU_SALT
// PAYU_BASE_URL=https://sandboxsecure.payu.in/_payment (for sandbox)
// PAYU_BASE_URL=https://secure.payu.in/_payment (for production)
// FRONTEND_URL=http://localhost:5173 (or your actual frontend URL)

// API to register user
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Missing Details. All fields are required." });
        }

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "User with this email already exists." });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        }

        if (!validator.isStrongPassword(password, { minLength: 8, minNumbers: 1, minSymbols: 1, minLowercase: 1, minUppercase: 1 })) {
            return res.status(400).json({ success: false, message: "Please enter a stronger password (min 8 chars, include numbers, symbols & mix of uppercase and lowercase characters)." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userData = {
            name,
            email,
            password: hashedPassword
        };

        const newUser = new userModel(userData);
        const user = await newUser.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '3h' });

        res.status(201).json({ success: true, token });

    } catch (error) {
        console.error("Error during user registration:", error);
        res.status(500).json({ success: false, message: "Server error during registration. Please try again." });
    }
};


// API for user login
const loginUser = async (req, res) => {
    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Missing email or password." });
        }

        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(400).json({ success: false, message: "User does not exist" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '3h' });
            res.json({ success: true, token });
        } else {
            res.status(400).json({ success: false, message: "Invalid Credentials." });
        }

    } catch (error) {
        console.error("Error during user login:", error);
        res.status(500).json({ success: false, message: "An unexpected error occurred during login. Please try again." });
    }
};

// API to get USER profile data
const getProfile = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID not found in request context." });
        }

        const userData = await userModel.findById(userId).select('-password');

        if (!userData) {
            return res.status(404).json({ success: false, message: "User profile not found." });
        }

        res.json({ success: true, userData });

    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ success: false, message: "An unexpected error occurred while fetching profile. Please try again." });
    }
};

// API to update user profile
const updateProfile = async (req, res) => {
    try {
        const { name, phone, address, dob, gender } = req.body;
        const userId = req.userId;
        const imageFile = req.file;

        if (!name || !phone || !address || !dob || !gender) {
            return res.json({ success: false, message: "Data Missing" });
        }

        await userModel.findByIdAndUpdate(userId, { name, phone, address: JSON.parse(address), dob, gender });

        if (imageFile) {
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: 'image' });
            const imageUrl = imageUpload.secure_url;
            await userModel.findByIdAndUpdate(userId, { image: imageUrl });
        }

        res.json({ success: true, message: "Profile Updated" });

    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ success: false, message: "An unexpected error occurred while fetching profile. Please try again." });
    }
};

// API to book appointment
const bookAppointment = async (req, res) => {
    try {
        const { docId, slotDate, slotTime } = req.body;
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated." });
        }

        const docData = await doctorModel.findById(docId).select('-password');

        if (!docData) {
            return res.status(404).json({ success: false, message: "Doctor not found." });
        }

        if (!docData.available) {
            return res.json({ success: false, message: 'Doctor not available' });
        }

        let updatedSlotsBooked = JSON.parse(JSON.stringify(docData.slots_booked || {}));

        if (updatedSlotsBooked[slotDate] && updatedSlotsBooked[slotDate].includes(slotTime)) {
            return res.json({ success: false, message: 'This slot is no longer available.' });
        }

        if (!updatedSlotsBooked[slotDate]) {
            updatedSlotsBooked[slotDate] = [];
        }
        updatedSlotsBooked[slotDate].push(slotTime);
        updatedSlotsBooked[slotDate].sort();


        const userData = await userModel.findById(userId).select('-password');

        if (!userData) {
            return res.status(404).json({ success: false, message: "User profile not found." });
        }

        const docDataForAppointment = docData.toObject();
        delete docDataForAppointment.slots_booked;

        const appointmentData = {
            userId,
            docId,
            userData,
            docData: docDataForAppointment,
            amount: docData.fees,
            slotTime,
            slotDate,
            date: Date.now(),
            paymentStatus: 'pending' // Set initial payment status
        };

        const newAppointment = new appointmentModel(appointmentData);
        await newAppointment.save();

        let hasAnyFutureSlots = false;
        for (const dateKey in updatedSlotsBooked) {
            if (updatedSlotsBooked[dateKey].length > 0) {
                const [day, month, year] = dateKey.split('_').map(Number);
                const slotDateObj = new Date(year, month - 1, day);

                const now = new Date();
                now.setHours(0, 0, 0, 0);

                if (slotDateObj >= now) {
                    if (slotDateObj.toDateString() === new Date().toDateString()) {
                        const currentHour = new Date().getHours();
                        const currentMinute = new Date().getMinutes();
                        const futureTimes = updatedSlotsBooked[dateKey].filter(timeStr => {
                            let [hours, minutes] = timeStr.split(' ')[0].split(':').map(Number);
                            const ampm = timeStr.split(' ')[1];
                            if (ampm === 'PM' && hours < 12) hours += 12;
                            if (ampm === 'AM' && hours === 12) hours = 0;
                            return (hours > currentHour) || (hours === currentHour && minutes > currentMinute);
                        });
                        if (futureTimes.length > 0) {
                            hasAnyFutureSlots = true;
                            break;
                        }
                    } else {
                        hasAnyFutureSlots = true;
                        break;
                    }
                }
            }
        }

        await doctorModel.findByIdAndUpdate(
            docId,
            { $set: { slots_booked: updatedSlotsBooked, available: hasAnyFutureSlots } },
            { new: true, runValidators: true }
        );

        res.json({ success: true, message: 'Appointment Booked Successfully!', appointmentId: newAppointment._id });

    } catch (error) {
        console.error("Error booking appointment:", error);
        res.status(500).json({ success: false, message: "An unexpected error occurred while booking the appointment. Please try again." });
    }
};


const myAppointments = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated." });
        }

        const appointments = await appointmentModel.find({ userId }).sort({ date: -1 });

        if (!appointments || appointments.length === 0) {
            return res.json({ success: true, message: "No appointments found.", appointments: [] });
        }

        res.json({ success: true, message: "Appointments fetched successfully", appointments });

    } catch (error) {
        console.error("Error fetching user appointments:", error);
        res.status(500).json({ success: false, message: "An unexpected error occurred while fetching appointments. Please try again." });
    }
};

const cancelAppointment = async (req, res) => {
    try {
        const { appointmentId, slotDate, slotTime, docId } = req.body;
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated." });
        }
        if (!appointmentId || !slotDate || !slotTime || !docId) {
            return res.status(400).json({ success: false, message: "Missing appointment details for cancellation." });
        }

        const appointment = await appointmentModel.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({ success: false, message: "Appointment not found." });
        }

        if (appointment.userId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized to cancel this appointment." });
        }

        if (appointment.cancelled) {
            return res.json({ success: false, message: "Appointment is already cancelled." });
        }

        appointment.cancelled = true;
        appointment.paymentStatus = 'cancelled_by_user'; // Update payment status on cancellation
        await appointment.save();

        const doctor = await doctorModel.findById(docId).select('slots_booked');

        if (!doctor) {
            console.error(`Doctor with ID ${docId} not found for appointment ${appointmentId}`);
            return res.status(404).json({ success: false, message: "Doctor record not found for slot update." });
        }

        let updatedSlotsBooked = JSON.parse(JSON.stringify(doctor.slots_booked || {}));

        if (updatedSlotsBooked[slotDate]) {
            updatedSlotsBooked[slotDate] = updatedSlotsBooked[slotDate].filter(
                (time) => time !== slotTime
            );

            if (updatedSlotsBooked[slotDate].length === 0) {
                delete updatedSlotsBooked[slotDate];
            }
        }

        let hasAnyFutureSlots = false;
        for (const dateKey in updatedSlotsBooked) {
            if (updatedSlotsBooked[dateKey].length > 0) {
                const [day, month, year] = dateKey.split('_').map(Number);
                const slotDateObj = new Date(year, month - 1, day);

                const now = new Date();
                now.setHours(0, 0, 0, 0);

                if (slotDateObj >= now) {
                    if (slotDateObj.toDateString() === new Date().toDateString()) {
                        const currentHour = new Date().getHours();
                        const currentMinute = new Date().getMinutes();
                        const futureTimes = updatedSlotsBooked[dateKey].filter(timeStr => {
                            let [hours, minutes] = timeStr.split(' ')[0].split(':').map(Number);
                            const ampm = timeStr.split(' ')[1];
                            if (ampm === 'PM' && hours < 12) hours += 12;
                            if (ampm === 'AM' && hours === 12) hours = 0;
                            return (hours > currentHour) || (hours === currentHour && minutes > currentMinute);
                        });
                        if (futureTimes.length > 0) {
                            hasAnyFutureSlots = true;
                            break;
                        }
                    } else {
                        hasAnyFutureSlots = true;
                        break;
                    }
                }
            }
        }

        await doctorModel.findByIdAndUpdate(
            docId,
            { $set: { slots_booked: updatedSlotsBooked, available: hasAnyFutureSlots } },
            { new: true, runValidators: true }
        );

        res.json({ success: true, message: "Appointment cancelled successfully and slot freed." });

    } catch (error) {
        console.error("Error cancelling appointment:", error);
        res.status(500).json({ success: false, message: "An unexpected error occurred while cancelling the appointment. Please try again." });
    }
};

// --- PAYU INTEGRATION FUNCTIONS ---

const initiatePayuPayment = async (req, res) => {
    try {
        const { appointmentId } = req.body;
        const userId = req.userId; // From authUser middleware

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated." });
        }

        const appointment = await appointmentModel.findById(appointmentId);

        if (!appointment) {
            return res.status(404).json({ success: false, message: "Appointment not found." });
        }

        // Verify authorization: Ensure the current user owns this appointment
        if (appointment.userId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized to process payment for this appointment." });
        }

        if (appointment.paymentStatus === 'paid') {
            return res.json({ success: false, message: "This appointment has already been paid." });
        }
        if (appointment.cancelled) {
            return res.json({ success: false, message: "Cancelled appointments cannot be paid." });
        }

        const txnid = crypto.randomBytes(16).toString('hex'); // Generate unique transaction ID
        const amount = appointment.amount.toFixed(2); // Ensure amount is a string with 2 decimal places
        const productinfo = `Appointment with Dr. ${appointment.docData.name}`;
        const firstname = appointment.userData.name.split(' ')[0] || 'User';
        const email = appointment.userData.email;
        const phone = appointment.userData.phone || '9999999999'; // Provide a default phone if not available

        // Update appointment with PayU transaction ID
        appointment.payuTxnId = txnid;
        await appointment.save();

        const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
        const PAYU_SALT = process.env.PAYU_SALT;
        const PAYU_BASE_URL = process.env.PAYU_BASE_URL || 'https://test.payu.in/_payment'; // Default to sandbox

        // Hash calculation string (order is crucial as per PayU documentation)
        // key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
        const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${PAYU_SALT}`;

        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        // Construct response for frontend
        const paymentParams = {
            key: PAYU_MERCHANT_KEY,
            txnid: txnid,
            amount: amount,
            productinfo: productinfo,
            firstname: firstname,
            email: email,
            phone: phone,
            surl: `${process.env.FRONTEND_URL}/my-appointments?payment_status=success`, // Success URL for frontend
            furl: `${process.env.FRONTEND_URL}/my-appointments?payment_status=failure`, // Failure URL for frontend
            curl: `${process.env.FRONTEND_URL}/my-appointments?payment_status=cancelled`, // Cancel URL for frontend
            hash: hash,
            action: PAYU_BASE_URL, // PayU payment gateway URL
            appointmentId: appointment._id // Pass appointment ID back to frontend for reference
        };

        res.json({ success: true, message: "Payment initiation successful", paymentParams });

    } catch (error) {
        console.error("Error initiating PayU payment:", error);
        res.status(500).json({ success: false, message: "An unexpected error occurred while initiating payment. Please try again." });
    }
};

const payuCallback = async (req, res) => {
    try {
        console.log("PayU Callback: Received request body:", req.body); // Log the entire request body

        const {
            mihpayid, // PayU Payment ID
            txnid,    // Your transaction ID
            amount,
            productinfo,
            firstname,
            email,
            phone,
            status,   // Payment status (success, failure, pending)
            hash,     // Hash received from PayU
            key,
            unmappedstatus,
            field1, field2, field3, field4, field5, field6, field7, field8, field9, field10,
            error_code, error_Message,
            PG_TYPE, bank_ref_num, bankcode,
        } = req.body;

        console.log(`PayU Callback: Status: ${status}, TxnID: ${txnid}, Amount: ${amount}`);

        const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
        const PAYU_SALT = process.env.PAYU_SALT;

        // Verify the hash received from PayU
        // The order of parameters in the hash string is crucial and must match PayU's specification for callback
        // salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
        const hashString = `${PAYU_SALT}|${status}||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${PAYU_MERCHANT_KEY}`;
        const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

        console.log(`PayU Callback: Calculated Hash: ${calculatedHash}`);
        console.log(`PayU Callback: Received Hash: ${hash}`);

        if (calculatedHash !== hash) {
            console.error("PayU Callback: Hash mismatch detected!");
            console.error("PayU Callback: Received body:", req.body);
            console.error("PayU Callback: Calculated Hash:", calculatedHash);
            console.error("PayU Callback: Received Hash:", hash);
            return res.redirect(`${process.env.FRONTEND_URL}/my-appointments?payment_status=failure&message=HashMismatch`);
        }

        console.log(`PayU Callback: Hash verification successful for TxnID: ${txnid}`);

        // Find the appointment using your transaction ID (txnid)
        const appointment = await appointmentModel.findOne({ payuTxnId: txnid });

        if (!appointment) {
            console.error(`PayU Callback: Appointment not found for txnid: ${txnid}`);
            return res.redirect(`${process.env.FRONTEND_URL}/my-appointments?payment_status=failure&message=AppointmentNotFound`);
        }

        console.log(`PayU Callback: Found appointment for TxnID ${txnid}. Current status: ${appointment.paymentStatus}`);

        // Update payment status based on PayU's response
        if (status === 'success') {
            appointment.paymentStatus = 'paid';
            appointment.payuPaymentId = mihpayid; // Store PayU's payment ID
            console.log(`PayU Callback: Attempting to save appointment ${appointment._id} with status 'paid'.`);
            await appointment.save(); // <--- This is the save operation
            console.log(`PayU Callback: Payment successful and appointment ${appointment._id} saved as 'paid'.`);
            res.redirect(`${process.env.FRONTEND_URL}/my-appointments?payment_status=success&appointmentId=${appointment._id}`);
        } else if (status === 'failure') {
            appointment.paymentStatus = 'failed';
            console.log(`PayU Callback: Attempting to save appointment ${appointment._id} with status 'failed'.`);
            await appointment.save();
            console.log(`PayU Callback: Payment failed and appointment ${appointment._id} saved as 'failed'.`);
            res.redirect(`${process.env.FRONTEND_URL}/my-appointments?payment_status=failure&appointmentId=${appointment._id}`);
        } else {
            // Handle other statuses like 'pending' or 'cancelled' if necessary
            console.log(`PayU Callback: Payment status ${status} for appointment ${appointment._id}. No change to 'paid' or 'failed'.`);
            res.redirect(`${process.env.FRONTEND_URL}/my-appointments?payment_status=${status}&appointmentId=${appointment._id}`);
        }

    } catch (error) {
        console.error("PayU Callback: Critical error in callback processing:", error); // Catch all errors here
        // Ensure a redirect happens even on internal server error
        res.redirect(`${process.env.FRONTEND_URL}/my-appointments?payment_status=failure&message=ServerError`);
    }
};


export { registerUser, loginUser, getProfile, updateProfile, bookAppointment, myAppointments, cancelAppointment, initiatePayuPayment, payuCallback };
