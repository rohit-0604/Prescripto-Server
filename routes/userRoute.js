import express from 'express'; // Import express to use express.urlencoded
import { 
    registerUser, 
    loginUser, 
    getProfile, 
    updateProfile, 
    bookAppointment, 
    myAppointments, 
    cancelAppointment,
    initiatePayuPayment, // Import new PayU function
    payuCallback         // Import new PayU function
} from '../controllers/userController.js';
import authUser from '../middlewares/authUser.js';
import upload from '../middlewares/multer.js'; // Assuming this is your multer middleware

const userRouter = express.Router();

userRouter.post('/register', registerUser);
userRouter.post('/login', loginUser);

userRouter.get('/get-profile', authUser, getProfile);
// Ensure multer upload.single('image') comes before authUser if authUser relies on req.file
userRouter.post('/update-profile', upload.single('image'), authUser, updateProfile); 
userRouter.post('/book-appointment', authUser, bookAppointment);
userRouter.get('/my-appointments', authUser, myAppointments); // Keeping GET as per your provided code
userRouter.post('/cancel-appointment', authUser, cancelAppointment);

// --- NEW PAYU ROUTES ---
userRouter.post('/payu-payment-initiate', authUser, initiatePayuPayment); // Endpoint to initiate payment
// PayU will POST to this URL, and it sends x-www-form-urlencoded data
// It does NOT need authUser middleware as PayU is calling it, not your user.
userRouter.post('/payu-callback', express.urlencoded({ extended: true }), payuCallback);
// -----------------------

export default userRouter;
