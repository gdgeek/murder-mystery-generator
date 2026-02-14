/**
 * Server entry point — starts the Express app.
 */
import app from './app';
import { validateEnv } from './config/env-validator';

validateEnv();

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
