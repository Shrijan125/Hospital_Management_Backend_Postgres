import dotenv from "dotenv";
import { app } from "./app";

dotenv.config({ path: "./.env" });
app.on("error", (error) => {
  console.log("Error: ", error);
  throw error;
});
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is 
   listening at port: ${PORT}`);
});
