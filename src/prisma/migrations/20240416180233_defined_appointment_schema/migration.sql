-- CreateTable
CREATE TABLE "Appointment" (
    "id" SERIAL NOT NULL,
    "doctorID" INTEGER NOT NULL,
    "userID" INTEGER NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "deptID" INTEGER NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorID_fkey" FOREIGN KEY ("doctorID") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_deptID_fkey" FOREIGN KEY ("deptID") REFERENCES "Dept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
