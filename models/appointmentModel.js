import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    docId: { type: String, required: true },
    slotDate: { type: String, required: true },
    slotTime: { type: String, required: true },
    userData: { type: Object, required: true },
    docData: { type: Object, required: true },
    amount: { type: Number, required: true },
    date: { type: Number, required: true },
    cancelled: { type: Boolean, default: false },
    
    // --- NEW FIELDS FOR PAYMENT STATUS (replacing old 'payment' boolean) ---
    paymentStatus: { type: String, default: 'pending' }, // 'pending', 'paid', 'failed', 'cancelled_by_user', 'refunded'
    payuTxnId: { type: String },
    payuPaymentId: { type: String },
    // ---------------------------------------------------------------------

    isCompleted: { type: Boolean, default: false }
}, { timestamps: true }); // Adding timestamps for createdAt/updatedAt is good practice

const appointmentModel = mongoose.models.appointment || mongoose.model('appointment', appointmentSchema);

export default appointmentModel;
