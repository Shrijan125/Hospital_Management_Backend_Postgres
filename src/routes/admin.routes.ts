import { Router } from "express";
import {
  signUpAdmin,
  loginAdmin,
  addDoctor,
  addDepartment,
  getDepartment,
  addMedicineCategory,
  addMedicine,
  getMedicineCategory,
} from "../controllers/admin.controller";
import { upload } from "../middlewares/multer.middleware";

const router = Router();

router.route("/signup").post(signUpAdmin);

router.route("/login").post(loginAdmin);

router.route("/add-doctor").post(upload.single("profile"), addDoctor);

router.route("/add-department").post(addDepartment);

router.route("/get-department").get(getDepartment);

router.route("/add-medicine-category").post(addMedicineCategory);

router.route("/add-medicine").post(upload.single("medImage"), addMedicine);

router.route("/get-medicine-category").get(getMedicineCategory);

export default router;
