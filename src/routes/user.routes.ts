import { Router } from "express";
import { upload } from "../middlewares/multer.middleware";
import {
  SignUpUser,
  changeCurrentPassword,
  getAvailableSlot,
  getCurrentUser,
  getDepartment,
  getDoctors,
  loginUser,
  logoutUser,
  refreshAccessToken,
  updateEmail,
  updateUserProfile,
  bookAppointment,
  getAppointments,
} from "../controllers/user.controller";
const router = Router();

router.route("/register").post(SignUpUser);

router.route("/login").post(loginUser);

router.route("/getCurrentUser").get(getCurrentUser);

router.route("/change-password").put(changeCurrentPassword);

router.route("/refresh-token").post(refreshAccessToken);

router.route("/logout").post(logoutUser);

router.route("/getDoctors").get(getDoctors);

router.route("/getDepartment").get(getDepartment);

router.route("/update-email").put(updateEmail);

router
  .route("/updateUserProfile")
  .put(upload.single("profile"), updateUserProfile);
router.route("/getSlots").get(getAvailableSlot);

router.route("/book-appointment").post(bookAppointment);

router.route("/get-appointments").get(getAppointments);

export default router;
