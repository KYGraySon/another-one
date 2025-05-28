import * as dotenv from "dotenv";
import { Connection } from "@solana/web3.js";

dotenv.config();

const config = {
  botToken: process.env.BOT_TOKEN,
  apiKey: process.env.API_KEY,
  secretKey: process.env.SECRET_KEY,
  baseUrl: process.env.BASE_URL,
  rpcUrl: process.env.RPC_URL,
  botUsername: process.env.BOT_USERNAME,
  redisUrl: process.env.REDIS_URL,
  mikeUsername: process.env.MIKE_USERNAME,
  otherUsername: process.env.OTHER_USERNAME,
  moralisKey: process.env.MORALIS_KEY,
  newBotToken: process.env.NEW_BOT_TOKEN,
};

export const connection = new Connection(
  config.rpcUrl ?? "https://api.mainnet-beta.solana.com",
  "confirmed"
);

export default config;
