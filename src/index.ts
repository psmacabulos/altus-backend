import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware must be registered before routes.
// helmet sets security headers, cors allows cross-origin requests from the frontend,
// express.json parses incoming JSON request bodies into req.body.
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server now running on port ${PORT}`);
});
