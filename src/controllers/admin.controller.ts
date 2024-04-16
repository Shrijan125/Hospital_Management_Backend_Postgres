import { PrismaClient, TimeSlot } from "@prisma/client";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { uploadOnCloudinary } from "../utils/cloudinary";
import { asyncHandler } from "../utils/asyncHandler";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { create } from "domain";

const prisma = new PrismaClient();

const signUpAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { email, adminID, password } = req.body;

  if (
    [email, adminID, password].some((field) => !field || field.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedAdmin = await prisma.admin.findUnique({ where: { adminID } });

  if (existedAdmin) {
    throw new ApiError(409, "Admin with email or adminID already exists");
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const createdAdmin = await prisma.admin.create({
    data: {
      email,
      adminID,
      password: hashedPassword,
    },
    select: {
      email: true,
      adminID: true,
    },
  });

  if (!createdAdmin) {
    throw new ApiError(500, "Something went wrong while registering the Admin");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdAdmin, "Admin registered successfully"));
});

const loginAdmin = asyncHandler(async (req, res) => {
  const { password, adminID } = req.body;
  if (!adminID) {
    throw new ApiError(400, "Admin ID is required");
  }

  const admin = await prisma.admin.findUnique({ where: { adminID } });
  if (!admin) {
    throw new ApiError(404, "Admin does not exist");
  }

  const isPasswordValid = await bcrypt.compare(password, admin.password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid Admin Credentials");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { admin: admin.adminID },
        "Admin logged in successfully."
      )
    );
});

const addDoctor = asyncHandler(async (req, res) => {
  const {
    name,
    consultationCharge,
    email,
    phone,
    availability,
    department,
    shortDescription,
    LongDescription,
  } = req.body;
  if (
    [
      name,
      consultationCharge,
      email,
      phone,
      shortDescription,
      LongDescription,
    ].some((field) => {
      if (typeof field === "string") {
        return field.trim() === "";
      }
    })
  ) {
    throw new ApiError(404, "All fields are required");
  }

  if (!availability || availability.length == 0) {
    throw new ApiError(404, "All fields are required");
  }

  const profileLocalPath = req.file?.path;

  if (!profileLocalPath) {
    throw new ApiError(400, "Profile file is missing");
  }

  const profile = await uploadOnCloudinary(profileLocalPath);

  if (profile == null || !profile.url) {
    throw new ApiError(400, "Error while uploading on profile");
  }

  const doctor = await prisma.doctor.create({
    data: {
      name,
      consultationCharge,
      profilePhoto: profile.url,
      email,
      phone,
      department: {
        connect: { id: parseInt(department) },
      },
      shortDescription,
      longDescription: LongDescription,
      availability: {
        create: availability.map((slot: any) => ({
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
          booked: slot.booked === "true",
        })) as TimeSlot[],
      },
    },
  });

  const createdDoctorId = await prisma.doctor.findUnique({
    where: { id: doctor.departmentId },
  });
  if (!createdDoctorId) {
    throw new ApiError(
      500,
      "Something went wrong while registering the Doctor"
    );
  }
  return res
    .status(201)
    .json(
      new ApiResponse(200, createdDoctorId, "Doctor registered successfully")
    );
});

const addDepartment = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (name === null || name.trim() === "") {
    throw new ApiError(400, "Department name is required");
  }

  const department = await prisma.dept.create({
    data: {
      name,
    },
  });
  const createdDepartmentId = await prisma.dept.findUnique({
    where: { id: department.id },
  });
  if (!createdDepartmentId) {
    throw new ApiError(
      500,
      "Something went wrong while creating the department"
    );
  }
  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        createdDepartmentId,
        "Department created Successfully successfully"
      )
    );
});

const getDepartment = asyncHandler(async (req, res) => {
  const getAllDepts = await prisma.dept.findMany({ select: { name: true } });
  if (!getAllDepts || getAllDepts.length === 0) {
    throw new ApiError(404, "No Department Found");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, getAllDepts, "Fetched Department names successfully")
    );
});

const addMedicineCategory = asyncHandler(async (req, res) => {
  const { category } = req.body;
  if (category === null || category.trim() === "") {
    throw new ApiError(400, "Category name is required");
  }

  const Category = await prisma.medCategory.create({ data: { category } });
  const createdCategoryId = await prisma.medCategory.findUnique({
    where: { id: Category.id },
  });
  if (!createdCategoryId) {
    throw new ApiError(500, "Something went wrong while creating the category");
  }
  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        createdCategoryId,
        "Category created Successfully successfully"
      )
    );
});

const addMedicine = asyncHandler(async (req, res) => {
  const { name, category, mfg, exp, prescReq, price } = req.body;
  if (
    [name, category, mfg, exp, prescReq, price].some((field) => {
      if (typeof field === "string") {
        return field.trim() === "";
      }
    })
  ) {
    throw new ApiError(404, "All fields are required");
  }
  if (mfg > exp) {
    throw new ApiError(400, "Manufacturing date greater than expiry date");
  }
  const medImageLocalPath = req.file?.path;

  if (!medImageLocalPath) {
    throw new ApiError(400, "Medicine image file is missing");
  }

  const medImage = await uploadOnCloudinary(medImageLocalPath);

  if (medImage == null || !medImage.url) {
    throw new ApiError(400, "Error while uploading medImage");
  }

  const med = await prisma.medicine.create({
    data: {
      name,
      category: { connect: { id: parseInt(category) } },
      mfg,
      exp,
      prescReq: prescReq === "true",
      price,
      medImage: medImage.url,
    },
  });

  const medId = await prisma.medicine.findUnique({ where: { id: med.id } });
  if (!medId) {
    throw new ApiError(
      500,
      "Something went wrong while registering the medicine"
    );
  }
  return res
    .status(201)
    .json(new ApiResponse(200, medId, "Medicine registered successfully"));
});

const getMedicineCategory = asyncHandler(async (req, res) => {
  const getAllCategory = await prisma.medCategory.findMany({
    select: { category: true },
  });
  if (!getAllCategory || getAllCategory.length === 0) {
    throw new ApiError(404, "No Category Found");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, getAllCategory, "Fetched Categories successfully")
    );
});

export {
  signUpAdmin,
  loginAdmin,
  addDoctor,
  addDepartment,
  getDepartment,
  addMedicineCategory,
  addMedicine,
  getMedicineCategory,
};
