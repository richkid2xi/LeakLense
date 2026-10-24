import dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app";

const port = process.env.PORT || 3001;
const app = createApp();

app.listen(port, () => {
  console.log(`LeakLens API server running on port ${port}`);
});
